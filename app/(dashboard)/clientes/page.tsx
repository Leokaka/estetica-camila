'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus, Search, Phone, Mail, Calendar, Edit, Trash2, History, User } from 'lucide-react'
import { format, differenceInYears } from 'date-fns'
import type { Cliente, Agendamento } from '@/types'
import { formatCurrency } from '@/lib/format'
import { STATUS_LABELS, STATUS_BADGE_VARIANT } from '@/lib/status'

const EMPTY_FORM = { nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '' }

export default function ClientesPage() {
  const supabase = createClient()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [histOpen, setHistOpen] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [clienteHist, setClienteHist] = useState<Cliente | null>(null)
  const [historico, setHistorico] = useState<Agendamento[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState<Cliente | null>(null)

  async function loadClientes() {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').order('nome')
    setClientes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadClientes() }, [])

  async function loadHistorico(cliente: Cliente) {
    setClienteHist(cliente)
    const { data } = await supabase
      .from('agendamentos')
      .select('*, servico:servicos(nome)')
      .eq('cliente_id', cliente.id)
      .order('data_hora', { ascending: false })
    setHistorico((data as any) ?? [])
    setHistOpen(true)
  }

  function abrirNovo() {
    setEditando(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function abrirEditar(c: Cliente) {
    setEditando(c)
    setForm({
      nome: c.nome,
      telefone: c.telefone,
      email: c.email ?? '',
      data_nascimento: c.data_nascimento ?? '',
      observacoes: c.observacoes ?? '',
    })
    setDialogOpen(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      nome: form.nome,
      telefone: form.telefone,
      email: form.email || null,
      data_nascimento: form.data_nascimento || null,
      observacoes: form.observacoes || null,
    }

    if (editando) {
      const { error } = await supabase.from('clientes').update(payload).eq('id', editando.id)
      if (error) toast.error('Erro ao atualizar cliente')
      else { toast.success('Cliente atualizado!'); setDialogOpen(false); loadClientes() }
    } else {
      const { error } = await supabase.from('clientes').insert(payload)
      if (error) toast.error('Erro ao cadastrar cliente')
      else { toast.success('Cliente cadastrado!'); setDialogOpen(false); loadClientes() }
    }
    setSalvando(false)
  }

  async function excluir(id: string) {
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir cliente')
    else { toast.success('Cliente excluída'); loadClientes() }
    setExcluindo(null)
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone.includes(busca) ||
    (c.email ?? '').toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-brand-dark tracking-wide">Clientes</h1>
          <p className="text-muted-foreground">{clientes.length} clientes cadastradas</p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="h-4 w-4 mr-2" /> Nova Cliente
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted-soft" />
        <Input
          placeholder="Buscar por nome, telefone ou email..."
          className="pl-10"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-brand-muted-soft">Carregando...</div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="text-center py-12 text-brand-muted-soft">
          {busca ? 'Nenhuma cliente encontrada' : 'Nenhuma cliente cadastrada ainda'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clientesFiltrados.map((c) => {
            const idade = c.data_nascimento
              ? differenceInYears(new Date(), new Date(c.data_nascimento + 'T00:00:00'))
              : null
            return (
              <Card key={c.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{c.nome}</CardTitle>
                        {idade && <span className="text-xs text-brand-muted-soft">{idade} anos</span>}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-brand-text-soft">
                    <Phone className="h-3.5 w-3.5 shrink-0" /> {c.telefone}
                  </div>
                  {c.email && (
                    <div className="flex items-center gap-2 text-sm text-brand-text-soft truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0" /> {c.email}
                    </div>
                  )}
                  {c.data_nascimento && (
                    <div className="flex items-center gap-2 text-sm text-brand-text-soft">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      {format(new Date(c.data_nascimento + 'T00:00:00'), 'dd/MM/yyyy')}
                    </div>
                  )}
                  {c.observacoes && (
                    <p className="text-xs text-brand-muted-soft italic truncate">{c.observacoes}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => loadHistorico(c)}>
                      <History className="h-3.5 w-3.5 mr-1" /> Histórico
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => abrirEditar(c)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-danger" onClick={() => setExcluindo(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog de cadastro/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Cliente' : 'Nova Cliente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Telefone / WhatsApp *</Label>
              <Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 99999-9999" required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Input type="date" value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Alergias, preferências, observações..." rows={3} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={salvando}>
                {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de histórico */}
      <Dialog open={histOpen} onOpenChange={setHistOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico — {clienteHist?.nome}</DialogTitle>
          </DialogHeader>
          {historico.length === 0 ? (
            <p className="text-center text-brand-muted-soft py-8">Nenhum atendimento registrado</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {historico.map((ag: any) => (
                <div key={ag.id} className="flex items-center justify-between p-3 rounded-lg border border-brand-border">
                  <div>
                    <p className="font-medium text-sm">{ag.servico?.nome}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(ag.data_hora), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm text-primary">{formatCurrency(ag.valor_cobrado)}</p>
                    <Badge variant={STATUS_BADGE_VARIANT[ag.status as Agendamento['status']]} className="text-xs">
                      {STATUS_LABELS[ag.status as Agendamento['status']]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!excluindo} onOpenChange={(open) => !open && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove {excluindo?.nome} e o histórico associado não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => excluindo && excluir(excluindo.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
