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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox, ComboboxContent, ComboboxInput, ComboboxInputGroup, ComboboxItem, useComboboxFilter } from '@/components/ui/combobox'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, CheckCircle, XCircle, MessageCircle, UserPlus, CalendarClock } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Agendamento, Cliente, Servico } from '@/types'
import { diaFunciona, horariosDisponiveis, agendamentosParaOcupados } from '@/lib/agenda'
import { formatCurrency } from '@/lib/format'
import {
  STATUS_LABELS, STATUS_BADGE_VARIANT,
  FORMA_PAGAMENTO_LABELS, STATUS_PAGAMENTO_LABELS, STATUS_PAGAMENTO_BADGE_VARIANT,
} from '@/lib/status'
import { linkWhatsApp, mensagemConfirmacao } from '@/lib/whatsapp'

const EMPTY_FORM = {
  cliente_id: '', servico_id: '', data: '', hora: '', status: 'agendado',
  local: 'quartinho', valor_cobrado: '', observacoes: '',
  forma_pagamento: '', status_pagamento: 'pendente', valor_pago: '', data_prevista_pagamento: '',
}

// Promoção de inauguração — arredonda pra baixo (bate com a tabela divulgada).
// Vale só pra atendimentos com data até PROMO_FIM (combinado com a Camila) —
// não é sobre quando a promo é aplicada, é sobre a data do procedimento em si.
const PROMO_ATIVA = true
const PROMO_FIM = '2026-08-31'
const PROMO_LABEL = '15% de inauguração'
function precoPromo(preco: number) {
  return Math.floor(preco * 0.85)
}
function promoValidaPara(data: string) {
  return !data || data <= PROMO_FIM
}

type AcaoTipo = 'realizado' | 'cancelar' | 'excluir'

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
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(new Date())
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [promo15, setPromo15] = useState(false)
  const [novaCliente, setNovaCliente] = useState<{ nome: string; telefone: string } | null>(null)
  const [salvandoCliente, setSalvandoCliente] = useState(false)
  const [acao, setAcao] = useState<{ tipo: AcaoTipo; ag: Agendamento } | null>(null)

  useEffect(() => {
    loadData()
  }, [mesAtual])

  async function loadData() {
    setLoading(true)
    const inicio = startOfMonth(mesAtual).toISOString()
    const fim = endOfMonth(mesAtual).toISOString()

    const [{ data: ags }, { data: cls }, { data: svs }] = await Promise.all([
      supabase.from('agendamentos')
        .select('*, cliente:clientes(id, nome, telefone), servico:servicos(id, nome, preco, duracao_minutos)')
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
    setForm({ ...EMPTY_FORM, data: data ? format(data, 'yyyy-MM-dd') : '' })
    setPromo15(false)
    setNovaCliente(null)
    setDialogOpen(true)
  }

  function abrirEditar(ag: Agendamento) {
    setEditando(ag)
    const dt = new Date(ag.data_hora)
    setForm({
      cliente_id: ag.cliente_id,
      servico_id: ag.servico_id,
      data: format(dt, 'yyyy-MM-dd'),
      hora: format(dt, 'HH:mm'),
      status: ag.status,
      local: ag.local ?? 'quartinho',
      valor_cobrado: String(ag.valor_cobrado),
      observacoes: ag.observacoes ?? '',
      forma_pagamento: ag.forma_pagamento ?? '',
      status_pagamento: ag.status_pagamento ?? 'pendente',
      valor_pago: ag.valor_pago != null ? String(ag.valor_pago) : '',
      data_prevista_pagamento: ag.data_prevista_pagamento ?? '',
    })
    setDialogOpen(true)
  }

  // Horários possíveis pro serviço+data escolhidos, descontando conflitos existentes.
  // Ao editar, o próprio agendamento não conta como conflito consigo mesmo.
  const servicoEscolhido = servicos.find(s => s.id === form.servico_id)
  const horariosDoServico = (() => {
    if (!form.servico_id || !form.data) return []
    const duracao = servicoEscolhido?.duracao_minutos ?? 60
    const dataObj = new Date(form.data + 'T00:00:00')
    const ocupados = agendamentosParaOcupados(
      agendamentos.filter((ag: any) =>
        ag.status !== 'cancelado' &&
        ag.id !== editando?.id &&
        isSameDay(new Date(ag.data_hora), dataObj)
      )
    )
    return horariosDisponiveis({ duracaoMinutos: duracao, ocupados })
  })()

  // Tira rápida de dias do mês carregado, pra sugerir data ao marcar ou reagendar
  // sem precisar abrir o calendário nativo. Só cobre o mês em exibição (mesAtual).
  const diasParaEscolher = (() => {
    const hoje = startOfDay(new Date())
    const inicioMes = startOfMonth(mesAtual)
    const inicio = isBefore(inicioMes, hoje) ? hoje : inicioMes
    const fim = endOfMonth(mesAtual)
    if (isBefore(fim, inicio)) return []
    return eachDayOfInterval({ start: inicio, end: fim })
  })()

  function horariosLivresNoDia(dia: Date) {
    if (!servicoEscolhido) return diaFunciona(dia)
    const ocupados = agendamentosParaOcupados(
      agendamentos.filter((ag: any) =>
        ag.status !== 'cancelado' &&
        ag.id !== editando?.id &&
        isSameDay(new Date(ag.data_hora), dia)
      )
    )
    return horariosDisponiveis({ duracaoMinutos: servicoEscolhido.duracao_minutos, ocupados }).length > 0
  }

  const filtroClientes = useComboboxFilter()
  const filtroServicos = useComboboxFilter()

  function onSelectServico(servicoId: string | null) {
    const id = servicoId ?? ''
    const svc = servicos.find(s => s.id === id)
    const base = svc ? Number(svc.preco) : null
    setForm(f => ({
      ...f,
      servico_id: id,
      valor_cobrado: base !== null ? String(promo15 ? precoPromo(base) : base) : f.valor_cobrado,
    }))
  }

  function togglePromo(checked: boolean) {
    setPromo15(checked)
    const svc = servicos.find(s => s.id === form.servico_id)
    if (svc) {
      const base = Number(svc.preco)
      setForm(f => ({ ...f, valor_cobrado: String(checked ? precoPromo(base) : base) }))
    }
  }

  // Troca a data do agendamento e, se a nova data já passou da validade da
  // promoção, desliga o desconto sozinho e volta o valor pro preço cheio.
  function selecionarData(novaData: string) {
    const aindaValida = promoValidaPara(novaData)
    if (promo15 && !aindaValida) {
      setPromo15(false)
      toast.error(`A promoção de inauguração vale só até ${format(new Date(PROMO_FIM + 'T00:00:00'), 'dd/MM')}. Valor voltou pro preço cheio.`)
    }
    setForm(f => {
      const svc = servicos.find(s => s.id === f.servico_id)
      const valor = promo15 && !aindaValida && svc ? String(svc.preco) : f.valor_cobrado
      return { ...f, data: novaData, hora: '', valor_cobrado: valor }
    })
  }

  async function salvarNovaCliente() {
    if (!novaCliente?.nome.trim() || novaCliente.telefone.replace(/\D/g, '').length < 10) {
      toast.error('Preenche nome e WhatsApp da cliente.')
      return
    }
    setSalvandoCliente(true)
    const { data, error } = await supabase
      .from('clientes')
      .insert({ nome: novaCliente.nome.trim(), telefone: novaCliente.telefone })
      .select()
      .single()
    setSalvandoCliente(false)
    if (error || !data) { toast.error('Erro ao cadastrar cliente'); return }
    setClientes(cs => [...cs, data].sort((a, b) => a.nome.localeCompare(b.nome)))
    setForm(f => ({ ...f, cliente_id: data.id }))
    setNovaCliente(null)
    toast.success(`${data.nome} cadastrada!`)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      cliente_id: form.cliente_id,
      servico_id: form.servico_id,
      data_hora: new Date(`${form.data}T${form.hora}:00`).toISOString(),
      status: form.status as Agendamento['status'],
      local: form.local as Agendamento['local'],
      valor_cobrado: Number(form.valor_cobrado),
      observacoes: form.observacoes || null,
      forma_pagamento: form.forma_pagamento || null,
      status_pagamento: form.status_pagamento as Agendamento['status_pagamento'],
      valor_pago: form.status_pagamento === 'parcial' && form.valor_pago ? Number(form.valor_pago) : null,
      data_prevista_pagamento: form.status_pagamento !== 'pago' && form.data_prevista_pagamento ? form.data_prevista_pagamento : null,
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
    const desc = `${servico?.nome ?? 'Serviço'} - ${cliente?.nome ?? 'Cliente'}`
    await supabase.from('lancamentos').insert({
      tipo: 'entrada',
      descricao: desc,
      valor: Number(payload.valor_cobrado),
      categoria: 'Serviço',
      data: format(new Date(payload.data_hora), 'yyyy-MM-dd'),
      agendamento_id: agendamentoId,
    })
  }

  async function confirmarAcao() {
    if (!acao) return
    const { tipo, ag } = acao

    if (tipo === 'realizado') {
      const { error } = await supabase.from('agendamentos').update({ status: 'realizado' }).eq('id', ag.id)
      if (!error) {
        await registrarEntradaFinanceira(ag.id, { ...ag, data_hora: ag.data_hora })
        toast.success(`Realizado! ${formatCurrency(Number(ag.valor_cobrado))} lançado no financeiro.`)
        loadData()
      } else {
        toast.error('Erro ao marcar como realizado')
      }
    } else if (tipo === 'cancelar') {
      const { error } = await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', ag.id)
      if (error) toast.error('Erro ao cancelar')
      else { toast.success('Agendamento cancelado'); loadData() }
    } else {
      const { error } = await supabase.from('agendamentos').delete().eq('id', ag.id)
      if (error) toast.error('Erro ao excluir')
      else { toast.success('Agendamento excluído'); loadData() }
    }
    setAcao(null)
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
          <h1 className="font-heading text-3xl font-semibold text-brand-dark tracking-wide">Agendamentos</h1>
          <p className="text-muted-foreground">{format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
        <Button onClick={() => abrirNovo()}>
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
            {(['todos', 'agendado', 'confirmado', 'realizado', 'cancelado'] as const).map(s => (
              <Button
                key={s}
                size="sm"
                variant={filtroStatus === s ? 'default' : 'outline'}
                onClick={() => setFiltroStatus(s)}
              >
                {s === 'todos' ? 'Todos' : STATUS_LABELS[s]}
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
            <div className="text-center py-12 text-brand-muted-soft">Carregando...</div>
          ) : agendamentosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-brand-muted-soft">Nenhum agendamento neste mês</div>
          ) : (
            <div className="space-y-2">
              {agendamentosFiltrados.map((ag: any) => (
                <Card key={ag.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-sm">{ag.cliente?.nome}</p>
                        <Badge variant={STATUS_BADGE_VARIANT[ag.status as Agendamento['status']]}>
                          {STATUS_LABELS[ag.status as Agendamento['status']]}
                        </Badge>
                        {ag.status !== 'cancelado' && (
                          <Badge variant={STATUS_PAGAMENTO_BADGE_VARIANT[(ag.status_pagamento ?? 'pendente') as Agendamento['status_pagamento']]}>
                            {STATUS_PAGAMENTO_LABELS[(ag.status_pagamento ?? 'pendente') as Agendamento['status_pagamento']]}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{ag.servico?.nome}</p>
                      <p className="text-xs text-brand-muted-soft">
                        {format(new Date(ag.data_hora), "dd/MM 'às' HH:mm")}
                        {ag.forma_pagamento && ` · ${FORMA_PAGAMENTO_LABELS[ag.forma_pagamento as NonNullable<Agendamento['forma_pagamento']>]}`}
                      </p>
                      <div className="flex gap-1 mt-2">
                        {ag.status !== 'realizado' && ag.status !== 'cancelado' && (
                          <Button size="sm" variant="outline" className="text-success h-7 px-2 text-xs" onClick={() => setAcao({ tipo: 'realizado', ag })}>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Realizado
                          </Button>
                        )}
                        {ag.cliente?.telefone && ag.status !== 'cancelado' && (
                          <Button
                            size="sm" variant="outline"
                            className="text-success h-7 px-2"
                            title="Enviar confirmação no WhatsApp"
                            onClick={() => window.open(
                              linkWhatsApp(
                                ag.cliente.telefone,
                                mensagemConfirmacao(ag.cliente.nome, ag.servico?.nome ?? 'seu procedimento', new Date(ag.data_hora), Number(ag.valor_cobrado), false)
                              ), '_blank')}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {ag.status !== 'cancelado' && ag.status !== 'realizado' && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => abrirEditar(ag)} title="Mudar dia/horário">
                            <CalendarClock className="h-3.5 w-3.5 mr-1" /> Reagendar
                          </Button>
                        )}
                        {ag.status !== 'cancelado' && ag.status !== 'realizado' && (
                          <Button size="sm" variant="outline" className="text-danger h-7 px-2" onClick={() => setAcao({ tipo: 'cancelar', ag })} title="Cancelar">
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => abrirEditar(ag)} title="Editar detalhes">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-danger h-7 px-2" onClick={() => setAcao({ tipo: 'excluir', ag })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-primary">{formatCurrency(ag.valor_cobrado)}</p>
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
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
              {Array.from({ length: diasDoMes[0].getDay() }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {diasDoMes.map(dia => {
                const agsNoDia = agendamentos.filter(ag => ag.status !== 'cancelado' && isSameDay(new Date(ag.data_hora), dia))
                const hoje = isToday(dia)
                const selecionado = diaSelecionado && isSameDay(dia, diaSelecionado)
                const fechado = !diaFunciona(dia)
                return (
                  <button
                    key={dia.toISOString()}
                    onClick={() => setDiaSelecionado(selecionado ? null : dia)}
                    className={`relative p-2 rounded-lg text-sm text-center transition-all min-h-15 flex flex-col items-center gap-1
                      ${hoje && !selecionado ? 'ring-2 ring-brand-gold' : ''}
                      ${selecionado ? 'bg-primary text-primary-foreground' : fechado ? 'text-muted-foreground/50 hover:bg-muted' : 'hover:bg-muted'}
                    `}
                  >
                    <span className="font-medium">{format(dia, 'd')}</span>
                    {agsNoDia.length > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${selecionado ? 'bg-primary-foreground text-primary' : 'bg-accent text-primary'}`}>
                        {agsNoDia.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {diaSelecionado && (
              <Card className={isToday(diaSelecionado) ? 'border-brand-gold/50' : undefined}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {format(diaSelecionado, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      {isToday(diaSelecionado) && <Badge variant="info">Hoje</Badge>}
                    </span>
                    {diaFunciona(diaSelecionado) ? (
                      <Button size="sm" onClick={() => abrirNovo(diaSelecionado)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Agendar
                      </Button>
                    ) : (
                      <span className="text-xs text-brand-muted-soft">Fechado</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {agendamentosDoDia.length === 0 ? (
                    <p className="text-sm text-brand-muted-soft text-center py-4">Nenhum agendamento neste dia</p>
                  ) : (
                    <div className="space-y-2">
                      {agendamentosDoDia.map((ag: any) => (
                        <div key={ag.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-brand-border">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0 rounded-lg bg-brand-surface px-2.5 py-1.5 text-center">
                              <span className="font-heading text-sm font-semibold text-brand-dark">{format(new Date(ag.data_hora), 'HH:mm')}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{ag.cliente?.nome}</p>
                              <p className="text-xs text-muted-foreground truncate">{ag.servico?.nome}</p>
                            </div>
                          </div>
                          <div className="text-right space-y-1 shrink-0">
                            <p className="text-sm font-medium text-primary">{formatCurrency(ag.valor_cobrado)}</p>
                            <Badge variant={STATUS_BADGE_VARIANT[ag.status as Agendamento['status']]}>
                              {STATUS_LABELS[ag.status as Agendamento['status']]}
                            </Badge>
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
        <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Cliente *</Label>
                <button
                  type="button"
                  onClick={() => setNovaCliente(nc => nc ? null : { nome: '', telefone: '' })}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <UserPlus className="h-3.5 w-3.5" /> {novaCliente ? 'Cancelar' : 'Nova cliente'}
                </button>
              </div>
              {novaCliente ? (
                <div className="space-y-2 rounded-lg border border-brand-gold bg-brand-card p-3">
                  <Input
                    placeholder="Nome da cliente"
                    value={novaCliente.nome}
                    onChange={e => setNovaCliente(nc => nc && ({ ...nc, nome: e.target.value }))}
                  />
                  <Input
                    type="tel"
                    placeholder="WhatsApp (11) 9XXXX-XXXX"
                    value={novaCliente.telefone}
                    onChange={e => setNovaCliente(nc => nc && ({ ...nc, telefone: e.target.value }))}
                  />
                  <Button type="button" size="sm" className="w-full" disabled={salvandoCliente} onClick={salvarNovaCliente}>
                    {salvandoCliente ? 'Cadastrando...' : 'Cadastrar e selecionar'}
                  </Button>
                </div>
              ) : (
                <Combobox
                  items={clientes.map(c => c.id)}
                  value={form.cliente_id || null}
                  onValueChange={v => setForm(f => ({ ...f, cliente_id: v ?? '', }))}
                  itemToStringLabel={(id: string) => clientes.find(c => c.id === id)?.nome ?? ''}
                  filter={(id: string, query: string) => filtroClientes.contains(id, query, (v) => clientes.find(c => c.id === v)?.nome ?? '')}
                  openOnInputClick
                >
                  <ComboboxInputGroup>
                    <ComboboxInput placeholder="Buscar cliente..." />
                  </ComboboxInputGroup>
                  <ComboboxContent>
                    {(id: string) => (
                      <ComboboxItem key={id} value={id}>{clientes.find(c => c.id === id)?.nome}</ComboboxItem>
                    )}
                  </ComboboxContent>
                </Combobox>
              )}
            </div>
            <div className="space-y-2">
              <Label>Serviço *</Label>
              <Combobox
                items={servicos.map(s => s.id)}
                value={form.servico_id || null}
                onValueChange={onSelectServico}
                itemToStringLabel={(id: string) => servicos.find(s => s.id === id)?.nome ?? ''}
                filter={(id: string, query: string) => filtroServicos.contains(id, query, (v) => servicos.find(s => s.id === v)?.nome ?? '')}
                openOnInputClick
              >
                <ComboboxInputGroup>
                  <ComboboxInput placeholder="Buscar serviço..." />
                </ComboboxInputGroup>
                <ComboboxContent>
                  {(id: string) => (
                    <ComboboxItem key={id} value={id}>{servicos.find(s => s.id === id)?.nome}</ComboboxItem>
                  )}
                </ComboboxContent>
              </Combobox>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={e => selecionarData(e.target.value)}
                  required
                  className="h-8 w-auto text-xs"
                />
              </div>
              {diasParaEscolher.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {diasParaEscolher.map(dia => {
                    const valorDia = format(dia, 'yyyy-MM-dd')
                    const selecionado = form.data === valorDia
                    const fechado = !diaFunciona(dia)
                    const livre = !fechado && horariosLivresNoDia(dia)
                    return (
                      <button
                        key={valorDia}
                        type="button"
                        disabled={fechado}
                        onClick={() => selecionarData(valorDia)}
                        className={`flex shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2.5 py-1.5 text-center transition-colors
                          ${selecionado ? 'border-primary bg-primary text-primary-foreground' : fechado ? 'border-transparent text-muted-foreground/40' : livre ? 'border-brand-border bg-brand-card hover:border-primary' : 'border-brand-border bg-muted text-muted-foreground'}
                        `}
                      >
                        <span className="text-[10px] uppercase">{format(dia, 'EEEEEE', { locale: ptBR })}</span>
                        <span className="text-sm font-semibold">{format(dia, 'd')}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              {form.data && !diaFunciona(new Date(form.data + 'T00:00:00')) && (
                <p className="text-xs text-danger">Fechado aos domingos.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Horário *</Label>
              {!form.servico_id || !form.data ? (
                <p className="text-xs text-muted-foreground">Escolha o serviço e a data primeiro.</p>
              ) : horariosDoServico.length === 0 && !(editando && form.hora) ? (
                <p className="text-xs text-danger">Sem horário livre nesse dia pra esse serviço — tenta outro dia na tira acima.</p>
              ) : (
                <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-brand-border bg-brand-surface/50 p-2">
                  {horariosDoServico.map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, hora: h }))}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${form.hora === h ? 'border-primary bg-primary text-primary-foreground' : 'border-brand-border bg-brand-card hover:border-primary'}`}
                    >
                      {h}
                    </button>
                  ))}
                  {/* garante que o horário atual (edição) apareça mesmo se não estiver mais "livre" */}
                  {editando && form.hora && !horariosDoServico.includes(form.hora) && (
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, hora: form.hora }))}
                      className="rounded-lg border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                    >
                      {form.hora} (atual)
                    </button>
                  )}
                </div>
              )}
            </div>
            {form.servico_id && (
              <p className="text-xs text-muted-foreground -mt-1">
                Duração: {servicoEscolhido?.duracao_minutos ?? 60} min
              </p>
            )}
            {PROMO_ATIVA && !editando && (
              promoValidaPara(form.data) ? (
                <label className="flex items-center gap-2 rounded-lg border border-brand-terra bg-brand-surface-warm p-3 text-sm font-medium text-brand-terra cursor-pointer">
                  <input type="checkbox" checked={promo15} onChange={e => togglePromo(e.target.checked)} className="accent-brand-terra" />
                  Aplicar {PROMO_LABEL} (15% OFF) · válida até {format(new Date(PROMO_FIM + 'T00:00:00'), 'dd/MM')}
                </label>
              ) : (
                <p className="rounded-lg border border-brand-border bg-brand-surface p-3 text-xs text-muted-foreground">
                  A promoção de inauguração vale só pra atendimentos até {format(new Date(PROMO_FIM + 'T00:00:00'), 'dd/MM')} — essa data já passou da validade.
                </p>
              )
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={form.valor_cobrado} onChange={e => setForm(f => ({ ...f, valor_cobrado: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v ?? f.status }))}>
                  <SelectTrigger>
                    <SelectValue>
                      {STATUS_LABELS[form.status as Agendamento['status']]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(['agendado', 'confirmado', 'realizado', 'cancelado'] as const).map(s => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pagamento</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button type="button" size="sm" variant={form.status_pagamento === 'pendente' ? 'default' : 'outline'} onClick={() => setForm(f => ({ ...f, status_pagamento: 'pendente' }))}>Pendente</Button>
                <Button type="button" size="sm" variant={form.status_pagamento === 'parcial' ? 'default' : 'outline'} onClick={() => setForm(f => ({ ...f, status_pagamento: 'parcial' }))}>Parcial</Button>
                <Button type="button" size="sm" variant={form.status_pagamento === 'pago' ? 'default' : 'outline'} onClick={() => setForm(f => ({ ...f, status_pagamento: 'pago' }))}>Pago</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select value={form.forma_pagamento} onValueChange={v => setForm(f => ({ ...f, forma_pagamento: v ?? '' }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Não informado">
                      {form.forma_pagamento ? FORMA_PAGAMENTO_LABELS[form.forma_pagamento as keyof typeof FORMA_PAGAMENTO_LABELS] : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FORMA_PAGAMENTO_LABELS) as Array<keyof typeof FORMA_PAGAMENTO_LABELS>).map(k => (
                      <SelectItem key={k} value={k}>{FORMA_PAGAMENTO_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.status_pagamento === 'parcial' ? (
                <div className="space-y-2">
                  <Label>Valor já pago (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_pago} onChange={e => setForm(f => ({ ...f, valor_pago: e.target.value }))} />
                </div>
              ) : form.status_pagamento === 'pendente' ? (
                <div className="space-y-2">
                  <Label>Data prometida</Label>
                  <Input type="date" value={form.data_prevista_pagamento} onChange={e => setForm(f => ({ ...f, data_prevista_pagamento: e.target.value }))} />
                </div>
              ) : null}
            </div>
            {form.status_pagamento === 'parcial' && (
              <div className="space-y-2">
                <Label>Data prevista pro restante</Label>
                <Input type="date" value={form.data_prevista_pagamento} onChange={e => setForm(f => ({ ...f, data_prevista_pagamento: e.target.value }))} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={salvando || !form.cliente_id || !form.servico_id || !form.data || !form.hora}>
                {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Agendar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!acao} onOpenChange={(open) => !open && setAcao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {acao?.tipo === 'realizado' && `Marcar "${acao.ag.cliente?.nome}" como realizado?`}
              {acao?.tipo === 'cancelar' && 'Cancelar agendamento?'}
              {acao?.tipo === 'excluir' && 'Excluir agendamento?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {acao?.tipo === 'realizado' && `Isso lança ${formatCurrency(Number(acao.ag.valor_cobrado))} automaticamente no Financeiro.`}
              {acao?.tipo === 'cancelar' && 'O horário volta a ficar disponível pra outra cliente.'}
              {acao?.tipo === 'excluir' && 'Essa ação remove o registro e não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant={acao?.tipo === 'realizado' ? 'default' : 'destructive'}
              onClick={confirmarAcao}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
