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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Clock, Calculator } from 'lucide-react'
import type { Servico } from '@/types'
import { formatCurrency } from '@/lib/format'

const CATEGORIAS = ['Facial', 'Plasma', 'Cílios', 'Sobrancelha', 'Micropigmentação', 'Corporal', 'Geral']

const EMPTY_FORM = {
  nome: '', descricao: '', preco: '', custo: '',
  duracao_minutos: '60', categoria: 'Geral', ativo: true
}

function margemClasse(margem: number) {
  if (margem >= 50) return 'text-success'
  if (margem >= 30) return 'text-warning'
  return 'text-danger'
}

export default function ServicosPage() {
  const supabase = createClient()
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Servico | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [showInativos, setShowInativos] = useState(false)
  const [excluindo, setExcluindo] = useState<Servico | null>(null)

  async function loadServicos() {
    setLoading(true)
    const { data } = await supabase.from('servicos').select('*').order('categoria').order('nome')
    setServicos(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadServicos() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function abrirEditar(s: Servico) {
    setEditando(s)
    setForm({
      nome: s.nome,
      descricao: s.descricao ?? '',
      preco: String(s.preco),
      custo: String(s.custo),
      duracao_minutos: String(s.duracao_minutos),
      categoria: s.categoria,
      ativo: s.ativo,
    })
    setDialogOpen(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      nome: form.nome,
      descricao: form.descricao || null,
      preco: Number(form.preco),
      custo: Number(form.custo),
      duracao_minutos: Number(form.duracao_minutos),
      categoria: form.categoria,
      ativo: form.ativo,
    }

    if (editando) {
      const { error } = await supabase.from('servicos').update(payload).eq('id', editando.id)
      if (error) toast.error('Erro ao atualizar serviço')
      else { toast.success('Serviço atualizado!'); setDialogOpen(false); loadServicos() }
    } else {
      const { error } = await supabase.from('servicos').insert(payload)
      if (error) toast.error('Erro ao cadastrar serviço')
      else { toast.success('Serviço cadastrado!'); setDialogOpen(false); loadServicos() }
    }
    setSalvando(false)
  }

  async function toggleAtivo(s: Servico) {
    const { error } = await supabase.from('servicos').update({ ativo: !s.ativo }).eq('id', s.id)
    if (error) toast.error('Erro ao alterar status')
    else { toast.success(s.ativo ? 'Serviço desativado' : 'Serviço ativado'); loadServicos() }
  }

  async function excluir(id: string) {
    const { error } = await supabase.from('servicos').delete().eq('id', id)
    if (error) toast.error('Não é possível excluir — existem agendamentos vinculados')
    else { toast.success('Serviço excluído'); loadServicos() }
    setExcluindo(null)
  }

  const servicosFiltrados = servicos
    .filter(s => showInativos ? true : s.ativo)
    .filter(s => filtroCategoria === 'todas' ? true : s.categoria === filtroCategoria)

  const categorias = Array.from(new Set(servicos.map(s => s.categoria)))

  const lucroPotencial = form.preco && form.custo
    ? Number(form.preco) - Number(form.custo) : null
  const margemPotencial = lucroPotencial && Number(form.preco) > 0
    ? (lucroPotencial / Number(form.preco) * 100).toFixed(1) : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-brand-dark tracking-wide">Serviços</h1>
          <p className="text-muted-foreground">{servicos.filter(s => s.ativo).length} serviços ativos</p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="h-4 w-4 mr-2" /> Novo Serviço
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap items-center">
        <Button
          size="sm"
          variant={filtroCategoria === 'todas' ? 'default' : 'outline'}
          onClick={() => setFiltroCategoria('todas')}
        >
          Todas
        </Button>
        {categorias.map(cat => (
          <Button
            key={cat}
            size="sm"
            variant={filtroCategoria === cat ? 'default' : 'outline'}
            onClick={() => setFiltroCategoria(cat)}
          >
            {cat}
          </Button>
        ))}
        <Button
          size="sm"
          variant={showInativos ? 'default' : 'outline'}
          onClick={() => setShowInativos(!showInativos)}
          className="ml-auto"
        >
          {showInativos ? 'Ocultar Inativos' : 'Ver Inativos'}
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-brand-muted-soft">Carregando...</div>
      ) : servicosFiltrados.length === 0 ? (
        <div className="text-center py-12 text-brand-muted-soft">Nenhum serviço encontrado</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {servicosFiltrados.map((s) => {
            const lucro = s.preco - s.custo
            const margem = s.preco > 0 ? (lucro / s.preco * 100) : 0
            return (
              <Card key={s.id} className={`hover:shadow-md transition-shadow ${!s.ativo ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{s.nome}</CardTitle>
                      <Badge variant="outline" className="mt-1 text-xs">{s.categoria}</Badge>
                    </div>
                    {!s.ativo && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {s.descricao && <p className="text-xs text-muted-foreground">{s.descricao}</p>}

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-success-soft rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">Preço de Venda</p>
                      <p className="font-bold text-success">{formatCurrency(s.preco)}</p>
                    </div>
                    <div className="bg-danger-soft rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">Custo</p>
                      <p className="font-bold text-danger">{formatCurrency(s.custo)}</p>
                    </div>
                  </div>

                  <div className="bg-warning-soft rounded-lg p-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Lucro por atendimento</p>
                        <p className="font-bold text-warning">{formatCurrency(lucro)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Margem</p>
                        <p className={`font-bold text-sm ${margemClasse(margem)}`}>
                          {margem.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {s.duracao_minutos >= 60
                      ? `${Math.floor(s.duracao_minutos / 60)}h${s.duracao_minutos % 60 > 0 ? ` ${s.duracao_minutos % 60}min` : ''}`
                      : `${s.duracao_minutos} min`}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => toggleAtivo(s)}>
                      {s.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => abrirEditar(s)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-danger" onClick={() => setExcluindo(s)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Serviço *</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v ?? form.categoria })}>
                <SelectTrigger><SelectValue>{form.categoria}</SelectValue></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Preço de Venda (R$) *</Label>
                <Input type="number" step="0.01" min="0" value={form.preco} onChange={e => setForm({ ...form, preco: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Custo (R$) *</Label>
                <Input type="number" step="0.01" min="0" value={form.custo} onChange={e => setForm({ ...form, custo: e.target.value })} required />
              </div>
            </div>

            {/* Calculadora em tempo real */}
            {lucroPotencial !== null && (
              <div className={`rounded-lg p-3 border ${lucroPotencial >= 0 ? 'bg-success-soft border-success/20' : 'bg-danger-soft border-danger/20'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-brand-text-soft">Calculadora de Lucro</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Lucro por atendimento:</span>
                  <span className={`font-bold ${lucroPotencial >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(lucroPotencial)}
                  </span>
                </div>
                {margemPotencial && (
                  <div className="flex justify-between">
                    <span className="text-sm">Margem:</span>
                    <span className={`font-bold ${margemClasse(Number(margemPotencial))}`}>
                      {margemPotencial}%
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Duração (minutos)</Label>
              <Input type="number" min="5" step="5" value={form.duracao_minutos} onChange={e => setForm({ ...form, duracao_minutos: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={2} />
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

      <AlertDialog open={!!excluindo} onOpenChange={(open) => !open && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove &quot;{excluindo?.nome}&quot; do catálogo. Se houver agendamentos vinculados, a exclusão será bloqueada.
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
