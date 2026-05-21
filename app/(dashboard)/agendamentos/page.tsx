'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, CheckCircle, XCircle, Calendar } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Agendamento, Cliente, Servico } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  agendado: 'bg-blue-100 text-blue-700',
  confirmado: 'bg-green-100 text-green-700',
  realizado: 'bg-gray-100 text-gray-700',
  cancelado: 'bg-red-100 text-red-700',
}

const EMPTY_FORM = {
  cliente_id: '', servico_id: '', data_hora: '', status: 'agendado',
  local: 'quartinho', valor_cobrado: '', observacoes: ''
}

const LOCAL_LABELS: Record<string, { label: string; cor: string; split: number }> = {
  quartinho: { label: 'Quartinho', cor: 'bg-amber-100 text-amber-700', split: 1.0 },
  karine:    { label: 'Karine (60%)', cor: 'bg-purple-100 text-purple-700', split: 0.6 },
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function AgendamentosPage() {
  const supabase = createClient()
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Agendamento | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [mesAtual, setMesAtual] = useState(new Date())
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null)
  const [filtroStatus, setFiltroStatus] = useState('todos')

  useEffect(() => {
    loadData()
  }, [mesAtual])

  async function loadData() {
    setLoading(true)
    const inicio = startOfMonth(mesAtual).toISOString()
    const fim = endOfMonth(mesAtual).toISOString()

    const [{ data: ags }, { data: cls }, { data: svs }] = await Promise.all([
      supabase.from('agendamentos')
        .select('*, cliente:clientes(id, nome, telefone), servico:servicos(id, nome, preco)')
        .gte('data_hora', inicio).lte('data_hora', fim)
        .order('data_hora'),
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
    ])

    setAgendamentos((ags as any) ?? [])
    setClientes(cls ?? [])
    setServicos(svs ?? [])
    setLoading(false)
  }

  function abrirNovo(data?: Date) {
    setEditando(null)
    const dataHora = data ? format(data, "yyyy-MM-dd'T'HH:mm") : ''
    setForm({ ...EMPTY_FORM, data_hora: dataHora })
    setDialogOpen(true)
  }

  function abrirEditar(ag: Agendamento) {
    setEditando(ag)
    setForm({
      cliente_id: ag.cliente_id,
      servico_id: ag.servico_id,
      data_hora: format(new Date(ag.data_hora), "yyyy-MM-dd'T'HH:mm"),
      status: ag.status,
      local: ag.local ?? 'quartinho',
      valor_cobrado: String(ag.valor_cobrado),
      observacoes: ag.observacoes ?? '',
    })
    setDialogOpen(true)
  }

  function onSelectServico(servicoId: string | null) {
    const id = servicoId ?? ''
    const svc = servicos.find(s => s.id === id)
    setForm(f => ({ ...f, servico_id: id, valor_cobrado: svc ? String(svc.preco) : f.valor_cobrado }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      cliente_id: form.cliente_id,
      servico_id: form.servico_id,
      data_hora: new Date(form.data_hora).toISOString(),
      status: form.status as Agendamento['status'],
      local: form.local as Agendamento['local'],
      valor_cobrado: Number(form.valor_cobrado),
      observacoes: form.observacoes || null,
    }

    if (editando) {
      const { error } = await supabase.from('agendamentos').update(payload).eq('id', editando.id)
      if (error) toast.error('Erro ao atualizar agendamento')
      else {
        if (payload.status === 'realizado') {
          await registrarEntradaFinanceira(editando.id, payload)
        }
        toast.success('Agendamento atualizado!')
        setDialogOpen(false)
        loadData()
      }
    } else {
      const { data, error } = await supabase.from('agendamentos').insert(payload).select().single()
      if (error) toast.error('Erro ao criar agendamento')
      else {
        if (payload.status === 'realizado' && data) {
          await registrarEntradaFinanceira(data.id, payload)
        }
        toast.success('Agendamento criado!')
        setDialogOpen(false)
        loadData()
      }
    }
    setSalvando(false)
  }

  async function registrarEntradaFinanceira(agendamentoId: string, payload: any) {
    const cliente = clientes.find(c => c.id === payload.cliente_id)
    const servico = servicos.find(s => s.id === payload.servico_id)
    const split = payload.local === 'karine' ? 0.6 : 1.0
    const valorRecebido = Number(payload.valor_cobrado) * split
    const localLabel = payload.local === 'karine' ? ' (Karine 60%)' : ' (Quartinho)'
    const desc = `${servico?.nome ?? 'Serviço'} - ${cliente?.nome ?? 'Cliente'}${localLabel}`
    await supabase.from('lancamentos').insert({
      tipo: 'entrada',
      descricao: desc,
      valor: valorRecebido,
      categoria: 'Serviço',
      data: format(new Date(payload.data_hora), 'yyyy-MM-dd'),
      agendamento_id: agendamentoId,
    })
  }

  async function marcarRealizado(ag: Agendamento) {
    const { error } = await supabase.from('agendamentos').update({ status: 'realizado' }).eq('id', ag.id)
    if (!error) {
      await registrarEntradaFinanceira(ag.id, { ...ag, data_hora: ag.data_hora })
      toast.success('Atendimento marcado como realizado!')
      loadData()
    }
  }

  async function cancelar(id: string) {
    if (!confirm('Deseja cancelar este agendamento?')) return
    const { error } = await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', id)
    if (error) toast.error('Erro ao cancelar')
    else { toast.success('Agendamento cancelado'); loadData() }
  }

  async function excluir(id: string) {
    if (!confirm('Deseja excluir este agendamento?')) return
    const { error } = await supabase.from('agendamentos').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Agendamento excluído'); loadData() }
  }

  const diasDoMes = eachDayOfInterval({ start: startOfMonth(mesAtual), end: endOfMonth(mesAtual) })
  const agendamentosDoDia = diaSelecionado
    ? agendamentos.filter(ag => isSameDay(new Date(ag.data_hora), diaSelecionado))
    : []

  const agendamentosFiltrados = filtroStatus === 'todos'
    ? agendamentos
    : agendamentos.filter(ag => ag.status === filtroStatus)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
          <p className="text-gray-500">{format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
        <Button onClick={() => abrirNovo()} className="bg-[#7B4F2E] hover:bg-[#5C3D20]">
          <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
        </Button>
      </div>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['todos', 'agendado', 'confirmado', 'realizado', 'cancelado'].map(s => (
              <Button
                key={s}
                size="sm"
                variant={filtroStatus === s ? 'default' : 'outline'}
                className={filtroStatus === s ? 'bg-[#7B4F2E] hover:bg-[#5C3D20]' : ''}
                onClick={() => setFiltroStatus(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>

          <div className="flex gap-2 items-center">
            <Button variant="outline" size="sm" onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() - 1))}>
              ← Anterior
            </Button>
            <span className="text-sm font-medium px-2">{format(mesAtual, "MMMM yyyy", { locale: ptBR })}</span>
            <Button variant="outline" size="sm" onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() + 1))}>
              Próximo →
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Carregando...</div>
          ) : agendamentosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Nenhum agendamento neste mês</div>
          ) : (
            <div className="space-y-2">
              {agendamentosFiltrados.map((ag: any) => (
                <Card key={ag.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{ag.cliente?.nome}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ag.status]}`}>
                          {ag.status}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LOCAL_LABELS[ag.local ?? 'quartinho']?.cor}`}>
                          {LOCAL_LABELS[ag.local ?? 'quartinho']?.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{ag.servico?.nome}</p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(ag.data_hora), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-[#7B4F2E]">{formatCurrency(ag.valor_cobrado)}</p>
                      <div className="flex gap-1 mt-2">
                        {ag.status !== 'realizado' && ag.status !== 'cancelado' && (
                          <Button size="sm" variant="outline" className="text-green-600 h-7 px-2" onClick={() => marcarRealizado(ag)} title="Marcar como realizado">
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {ag.status !== 'cancelado' && ag.status !== 'realizado' && (
                          <Button size="sm" variant="outline" className="text-red-500 h-7 px-2" onClick={() => cancelar(ag.id)} title="Cancelar">
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => abrirEditar(ag)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-500 h-7 px-2" onClick={() => excluir(ag.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendario">
          <div className="space-y-4">
            <div className="flex gap-2 items-center">
              <Button variant="outline" size="sm" onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() - 1))}>
                ← Anterior
              </Button>
              <span className="text-sm font-medium px-2">{format(mesAtual, "MMMM yyyy", { locale: ptBR })}</span>
              <Button variant="outline" size="sm" onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() + 1))}>
                Próximo →
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
              ))}
              {Array.from({ length: diasDoMes[0].getDay() }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {diasDoMes.map(dia => {
                const agsNoDia = agendamentos.filter(ag => isSameDay(new Date(ag.data_hora), dia))
                const hoje = isToday(dia)
                const selecionado = diaSelecionado && isSameDay(dia, diaSelecionado)
                return (
                  <button
                    key={dia.toISOString()}
                    onClick={() => setDiaSelecionado(selecionado ? null : dia)}
                    className={`relative p-2 rounded-lg text-sm text-center transition-all min-h-[60px] flex flex-col items-center gap-1
                      ${hoje ? 'ring-2 ring-[#C8A882]' : ''}
                      ${selecionado ? 'bg-[#7B4F2E] text-white' : 'hover:bg-gray-100'}
                    `}
                  >
                    <span className="font-medium">{format(dia, 'd')}</span>
                    {agsNoDia.length > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${selecionado ? 'bg-white text-[#7B4F2E]' : 'bg-[#EDE4D8] text-[#7B4F2E]'}`}>
                        {agsNoDia.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {diaSelecionado && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{format(diaSelecionado, "dd 'de' MMMM", { locale: ptBR })}</span>
                    <Button size="sm" className="bg-[#7B4F2E] hover:bg-[#5C3D20]" onClick={() => abrirNovo(diaSelecionado)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Agendar
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {agendamentosDoDia.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Nenhum agendamento neste dia</p>
                  ) : (
                    <div className="space-y-2">
                      {agendamentosDoDia.map((ag: any) => (
                        <div key={ag.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <p className="font-medium text-sm">{ag.cliente?.nome}</p>
                            <p className="text-xs text-gray-500">{ag.servico?.nome} · {format(new Date(ag.data_hora), 'HH:mm')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-[#7B4F2E]">{formatCurrency(ag.valor_cobrado)}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[ag.status]}`}>{ag.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={form.cliente_id} onValueChange={v => setForm(f => ({ ...f, cliente_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a cliente" /></SelectTrigger>
                <SelectContent>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Serviço *</Label>
              <Select value={form.servico_id} onValueChange={onSelectServico}>
                <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                <SelectContent>
                  {servicos.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Local *</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['quartinho', 'karine'] as const).map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, local: loc }))}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      form.local === loc
                        ? loc === 'quartinho'
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    {loc === 'quartinho' ? '🏠 Quartinho' : '💜 Karine (60%)'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data e Hora *</Label>
              <Input type="datetime-local" value={form.data_hora} onChange={e => setForm(f => ({ ...f, data_hora: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={form.valor_cobrado} onChange={e => setForm(f => ({ ...f, valor_cobrado: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v ?? f.status }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                    <SelectItem value="realizado">Realizado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1 bg-[#7B4F2E] hover:bg-[#5C3D20]" disabled={salvando || !form.cliente_id || !form.servico_id}>
                {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Agendar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
