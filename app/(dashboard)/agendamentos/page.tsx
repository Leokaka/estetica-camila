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
import { Plus, Edit, Trash2, CheckCircle, XCircle, MessageCircle, UserPlus, CalendarClock, Search } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Agendamento, Cliente, Servico } from '@/types'
import { diaFunciona, horariosDisponiveis, agendamentosParaOcupados, paraMinutos, HORARIO_FUNCIONAMENTO } from '@/lib/agenda'
import { formatCurrency } from '@/lib/format'
import {
  STATUS_LABELS, STATUS_BADGE_VARIANT,
  FORMA_PAGAMENTO_LABELS, STATUS_PAGAMENTO_LABELS, STATUS_PAGAMENTO_BADGE_VARIANT,
} from '@/lib/status'
import { linkWhatsApp, mensagemConfirmacao, mensagemAgradecimento } from '@/lib/whatsapp'

// 'local' saiu da UI em 01/08/2026 — Camila fechou o quartinho e o acordo com a Karine,
// hoje só atende no espaço próprio dela. Campo mantido fixo em 'quartinho' só pra bater
// com a constraint do banco (NOT NULL); "karine" existe só em dado histórico de abr-jun/2026.
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

// Intensidade do dia no grid do mês (mapa de calor simplificado, referência: Trinks) —
// dá pra ver de relance quais dias estão cheios sem precisar clicar em cada um.
function intensidadeDia(qtd: number) {
  if (qtd === 0) return ''
  if (qtd <= 2) return 'bg-brand-gold/15'
  if (qtd <= 4) return 'bg-brand-gold/30'
  return 'bg-brand-gold/50'
}

const TIMELINE_STATUS_CLASSES: Record<Agendamento['status'], string> = {
  agendado: 'bg-warning-soft border-warning/50 text-warning',
  confirmado: 'bg-success-soft border-success/50 text-success',
  realizado: 'bg-info-soft border-info/50 text-info',
  cancelado: 'bg-muted border-border text-muted-foreground line-through opacity-70',
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
  // Procedimentos já configurados nessa sessão do dialog, aguardando o clique em
  // "Agendar" pra serem todos criados juntos — permite marcar vários procedimentos
  // pra mesma cliente numa única confirmação, em vez de reabrir o dialog pra cada um.
  const [fila, setFila] = useState<(typeof EMPTY_FORM)[]>([])
  const [salvando, setSalvando] = useState(false)
  const [mesAtual, setMesAtual] = useState(new Date())
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(new Date())
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [buscaCliente, setBuscaCliente] = useState('')
  const [promo15, setPromo15] = useState(false)
  const [novaClienteAberta, setNovaClienteAberta] = useState(false)
  const [novaCliente, setNovaCliente] = useState<{ nome: string; telefone: string }>({ nome: '', telefone: '' })
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
    setFila([])
    setPromo15(false)
    setNovaClienteAberta(false)
    setNovaCliente({ nome: '', telefone: '' })
    setDialogOpen(true)
  }

  function abrirEditar(ag: Agendamento) {
    setEditando(ag)
    setFila([])
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
    setNovaClienteAberta(false)
    setDialogOpen(true)
  }

  // Procedimentos já empilhados na fila (ainda não salvos) que caem num dia — viram
  // "ocupado" também, pra ela não conseguir marcar dois procedimentos da fila no
  // mesmo horário sem perceber.
  function filaComoOcupados(dataStr: string) {
    return fila
      .filter(item => item.data === dataStr)
      .map(item => ({ data_hora: `${item.data}T${item.hora}:00`, servico: servicos.find(s => s.id === item.servico_id) }))
  }

  // Horários possíveis pro serviço+data escolhidos, descontando conflitos existentes.
  // Ao editar, o próprio agendamento não conta como conflito consigo mesmo.
  const servicoEscolhido = servicos.find(s => s.id === form.servico_id)
  const horariosDoServico = (() => {
    if (!form.servico_id || !form.data) return []
    const duracao = servicoEscolhido?.duracao_minutos ?? 60
    const dataObj = new Date(form.data + 'T00:00:00')
    const ocupados = agendamentosParaOcupados([
      ...agendamentos.filter((ag: any) =>
        ag.status !== 'cancelado' &&
        ag.id !== editando?.id &&
        isSameDay(new Date(ag.data_hora), dataObj)
      ),
      ...filaComoOcupados(form.data),
    ])
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
    const ocupados = agendamentosParaOcupados([
      ...agendamentos.filter((ag: any) =>
        ag.status !== 'cancelado' &&
        ag.id !== editando?.id &&
        isSameDay(new Date(ag.data_hora), dia)
      ),
      ...filaComoOcupados(format(dia, 'yyyy-MM-dd')),
    ])
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
      // Duração pode mudar com o serviço — reconfere o horário em vez de manter um
      // horário que pode não caber mais (passar do fechamento ou bater em outro agendamento).
      hora: id !== f.servico_id ? '' : f.hora,
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
    if (!novaCliente.nome.trim() || novaCliente.telefone.replace(/\D/g, '').length < 10) {
      toast.error('Preenche nome e WhatsApp da cliente.')
      return
    }
    const telefoneNovo = novaCliente.telefone.replace(/\D/g, '')
    const duplicada = clientes.find(c => c.telefone.replace(/\D/g, '') === telefoneNovo)
    if (duplicada) {
      toast.error(`Esse WhatsApp já é da ${duplicada.nome} — busca o nome dela em vez de cadastrar de novo.`)
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
    setNovaCliente({ nome: '', telefone: '' })
    setNovaClienteAberta(false)
    toast.success(`${data.nome} cadastrada!`)
  }

  function paraPayload(f: typeof form) {
    return {
      cliente_id: f.cliente_id,
      servico_id: f.servico_id,
      data_hora: new Date(`${f.data}T${f.hora}:00`).toISOString(),
      status: f.status as Agendamento['status'],
      local: f.local as Agendamento['local'],
      valor_cobrado: Number(f.valor_cobrado),
      observacoes: f.observacoes || null,
      forma_pagamento: f.forma_pagamento || null,
      status_pagamento: f.status_pagamento as Agendamento['status_pagamento'],
      valor_pago: f.status_pagamento === 'parcial' && f.valor_pago ? Number(f.valor_pago) : null,
      data_prevista_pagamento: f.status_pagamento !== 'pago' && f.data_prevista_pagamento ? f.data_prevista_pagamento : null,
    }
  }

  const linhaAtualCompleta = !!(form.servico_id && form.data && form.hora && form.valor_cobrado)

  // Empilha o procedimento atual na fila (sem salvar no banco ainda) e libera os
  // campos pra ela configurar o próximo — mantém cliente e data, já que na prática
  // é sempre a mesma visita. Só existe pra agendamento novo, nunca em edição.
  function adicionarProcedimento() {
    if (!linhaAtualCompleta) {
      toast.error('Preenche serviço, data, horário e valor antes de adicionar outro procedimento.')
      return
    }
    setFila(fl => [...fl, form])
    setForm(f => ({
      ...f,
      servico_id: '', hora: '', valor_cobrado: '', observacoes: '',
      forma_pagamento: '', status_pagamento: 'pendente', valor_pago: '', data_prevista_pagamento: '', status: 'agendado',
    }))
    setPromo15(false)
    toast.success('Procedimento adicionado — configura o próximo.')
  }

  function removerDaFila(indice: number) {
    setFila(fl => fl.filter((_, i) => i !== indice))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)

    if (editando) {
      const payload = paraPayload(form)
      const { error } = await supabase.from('agendamentos').update(payload).eq('id', editando.id)
      if (error) toast.error('Erro ao atualizar agendamento')
      else {
        // Só lança no financeiro na transição pra "realizado" — evita duplicar entrada
        // toda vez que um agendamento já realizado é apenas editado de novo.
        if (payload.status === 'realizado' && editando.status !== 'realizado') {
          const valor = valorRecebidoAoRealizar(payload.status_pagamento, payload.valor_cobrado, payload.valor_pago)
          if (valor > 0) await registrarEntradaFinanceira(editando.id, payload, valor)
        }
        toast.success('Agendamento atualizado!')
        setDialogOpen(false)
        loadData()
      }
    } else {
      // Junta o que já tá na fila com a linha atual (se ela estiver preenchida) —
      // permite marcar vários procedimentos pra mesma cliente numa única confirmação.
      const linhas = linhaAtualCompleta ? [...fila, form] : fila
      if (linhas.length === 0) {
        toast.error('Preenche pelo menos um procedimento.')
        setSalvando(false)
        return
      }
      const payloads = linhas.map(paraPayload)
      const { data, error } = await supabase.from('agendamentos').insert(payloads).select()
      if (error) toast.error(payloads.length > 1 ? 'Erro ao criar os agendamentos' : 'Erro ao criar agendamento')
      else {
        if (data) {
          for (const row of data) {
            if (row.status === 'realizado') {
              const valor = valorRecebidoAoRealizar(row.status_pagamento, row.valor_cobrado, row.valor_pago)
              if (valor > 0) await registrarEntradaFinanceira(row.id, row, valor)
            }
          }
        }
        toast.success(payloads.length > 1 ? `${payloads.length} procedimentos agendados!` : 'Agendamento criado!')
        setDialogOpen(false)
        setFila([])
        loadData()
      }
    }
    setSalvando(false)
  }

  // Quanto entra de fato no financeiro ao marcar como realizado — só o que já foi
  // efetivamente recebido (pago inteiro, ou a parte já paga de um parcial). Pagamento
  // pendente não lança nada agora; quando o dinheiro chegar, é lançamento manual.
  function valorRecebidoAoRealizar(statusPagamento: string, valorCobrado: number, valorPago: number | null) {
    if (statusPagamento === 'pago') return valorCobrado
    if (statusPagamento === 'parcial') return Number(valorPago ?? 0)
    return 0
  }

  async function registrarEntradaFinanceira(agendamentoId: string, payload: any, valor: number) {
    const cliente = clientes.find(c => c.id === payload.cliente_id)
    const servico = servicos.find(s => s.id === payload.servico_id)
    const desc = `${servico?.nome ?? 'Serviço'} - ${cliente?.nome ?? 'Cliente'}`
    await supabase.from('lancamentos').insert({
      tipo: 'entrada',
      descricao: desc,
      valor,
      categoria: 'Serviço',
      data: format(new Date(payload.data_hora), 'yyyy-MM-dd'),
      agendamento_id: agendamentoId,
    })
  }

  async function confirmarAcao() {
    if (!acao) return
    const { tipo, ag } = acao

    if (tipo === 'realizado') {
      // O botão rápido assume pagamento em dinheiro na hora, igual sempre foi — só
      // não sobrescreve se já tinha marcado parcial/pago manualmente antes.
      const statusPagamento = ag.status_pagamento === 'pendente' || !ag.status_pagamento ? 'pago' : ag.status_pagamento
      const { error } = await supabase.from('agendamentos').update({ status: 'realizado', status_pagamento: statusPagamento }).eq('id', ag.id)
      if (!error) {
        const valor = valorRecebidoAoRealizar(statusPagamento, Number(ag.valor_cobrado), ag.valor_pago ?? null)
        if (valor > 0) await registrarEntradaFinanceira(ag.id, ag, valor)
        toast.success(valor > 0 ? `Realizado! ${formatCurrency(valor)} lançado no financeiro.` : 'Realizado!')
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
  const buscaAtiva = buscaCliente.trim().toLowerCase()
  const agendamentosDoDia = diaSelecionado
    ? agendamentos
        .filter(ag => isSameDay(new Date(ag.data_hora), diaSelecionado))
        .filter(ag => !buscaAtiva || (ag as any).cliente?.nome?.toLowerCase().includes(buscaAtiva))
    : []

  const hojeAgendamentos = agendamentos.filter(ag => ag.status !== 'cancelado' && isSameDay(new Date(ag.data_hora), new Date()))
  const hojeConfirmados = hojeAgendamentos.filter(ag => ag.status === 'confirmado' || ag.status === 'realizado').length
  const hojeAguardando = hojeAgendamentos.filter(ag => ag.status === 'agendado').length

  const agendamentosFiltrados = agendamentos
    .filter(ag => filtroStatus === 'todos' || ag.status === filtroStatus)
    .filter(ag => !buscaCliente.trim() || (ag as any).cliente?.nome?.toLowerCase().includes(buscaCliente.trim().toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-brand-dark tracking-wide">Agendamentos</h1>
          <p className="text-muted-foreground">{format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
        <Button onClick={() => abrirNovo()}>
          <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
        </Button>
      </div>

      <Tabs defaultValue="calendario">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted-soft" />
            <Input
              placeholder="Buscar por nome da cliente..."
              className="pl-10"
              value={buscaCliente}
              onChange={e => setBuscaCliente(e.target.value)}
            />
          </div>
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
                            title={ag.status === 'realizado' ? 'Enviar agradecimento no WhatsApp' : 'Enviar confirmação no WhatsApp'}
                            onClick={() => window.open(
                              linkWhatsApp(
                                ag.cliente.telefone,
                                ag.status === 'realizado'
                                  ? mensagemAgradecimento(ag.cliente.nome, ag.servico?.nome ?? 'seu procedimento')
                                  : mensagemConfirmacao(ag.cliente.nome, ag.servico?.nome ?? 'seu procedimento', new Date(ag.data_hora), Number(ag.valor_cobrado), false)
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
            {hojeAgendamentos.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-gold/40 bg-brand-surface-warm px-3 py-2 text-sm">
                <Badge variant="info">Hoje</Badge>
                <span className="font-medium text-brand-dark">{hojeAgendamentos.length} agendamento{hojeAgendamentos.length > 1 ? 's' : ''}</span>
                {hojeConfirmados > 0 && <span className="text-brand-text-soft">· {hojeConfirmados} confirmado{hojeConfirmados > 1 ? 's' : ''}</span>}
                {hojeAguardando > 0 && <span className="text-brand-text-soft">· {hojeAguardando} aguardando confirmação</span>}
                <button
                  type="button"
                  className="ml-auto text-xs font-medium text-primary hover:underline"
                  onClick={() => setDiaSelecionado(new Date())}
                >
                  Ver hoje
                </button>
              </div>
            )}

            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted-soft" />
              <Input
                placeholder="Buscar por nome da cliente..."
                className="pl-10"
                value={buscaCliente}
                onChange={e => setBuscaCliente(e.target.value)}
              />
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

            <div className="grid grid-cols-7 gap-1">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
              {Array.from({ length: diasDoMes[0].getDay() }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {diasDoMes.map(dia => {
                const agsNoDia = agendamentos
                  .filter(ag => ag.status !== 'cancelado' && isSameDay(new Date(ag.data_hora), dia))
                  .filter(ag => !buscaAtiva || (ag as any).cliente?.nome?.toLowerCase().includes(buscaAtiva))
                const hoje = isToday(dia)
                const selecionado = diaSelecionado && isSameDay(dia, diaSelecionado)
                const fechado = !diaFunciona(dia)
                return (
                  <button
                    key={dia.toISOString()}
                    onClick={() => setDiaSelecionado(selecionado ? null : dia)}
                    className={`relative p-2 rounded-lg text-sm text-center transition-all min-h-15 flex flex-col items-center gap-1
                      ${hoje && !selecionado ? 'ring-2 ring-brand-gold' : ''}
                      ${selecionado ? 'bg-primary text-primary-foreground' : fechado ? 'text-muted-foreground/50 hover:bg-muted' : `hover:bg-muted ${intensidadeDia(agsNoDia.length)}`}
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
                  ) : (() => {
                    const aberturaMin = paraMinutos(HORARIO_FUNCIONAMENTO.abertura)
                    const fechamentoMin = paraMinutos(HORARIO_FUNCIONAMENTO.fechamento)
                    const totalMin = fechamentoMin - aberturaMin
                    const horaInicio = Math.floor(aberturaMin / 60)
                    const horaFim = Math.ceil(fechamentoMin / 60)
                    const horasLinha = Array.from({ length: horaFim - horaInicio + 1 }, (_, i) => horaInicio + i)
                    return (
                      <div
                        className="relative ml-12 cursor-pointer rounded-lg border border-brand-border"
                        style={{ height: totalMin }}
                        onClick={() => diaFunciona(diaSelecionado) && abrirNovo(diaSelecionado)}
                      >
                        {horasLinha.map(h => (
                          <div
                            key={h}
                            className="absolute right-0 left-0 border-t border-brand-border/60"
                            style={{ top: Math.max(0, h * 60 - aberturaMin) }}
                          >
                            <span className="absolute -left-12 -translate-y-1/2 bg-card px-1 text-[10px] text-muted-foreground">
                              {String(h).padStart(2, '0')}:00
                            </span>
                          </div>
                        ))}
                        {agendamentosDoDia.map((ag: any) => {
                          const dt = new Date(ag.data_hora)
                          const inicioAg = dt.getHours() * 60 + dt.getMinutes()
                          const duracao = ag.servico?.duracao_minutos ?? 60
                          return (
                            <button
                              key={ag.id}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); abrirEditar(ag) }}
                              className={`absolute right-1 left-1 overflow-hidden rounded-md border px-2 py-1 text-left transition-opacity hover:opacity-80 ${TIMELINE_STATUS_CLASSES[ag.status as Agendamento['status']]}`}
                              style={{ top: Math.max(0, inicioAg - aberturaMin), height: Math.max(duracao, 22) }}
                            >
                              <span className="text-[11px] font-semibold">{format(dt, 'HH:mm')} · {ag.cliente?.nome}</span>
                              {duracao >= 30 && <span className="block truncate text-[10px]">{ag.servico?.nome}</span>}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })()}
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
                <Label htmlFor="ag-cliente">Cliente *</Label>
                <button
                  type="button"
                  onClick={() => setNovaClienteAberta(v => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <UserPlus className="h-3.5 w-3.5" /> {novaClienteAberta ? 'Cancelar' : 'Nova cliente'}
                </button>
              </div>
              {novaClienteAberta ? (
                <div className="space-y-2 rounded-lg border border-brand-gold bg-brand-card p-3">
                  <Input
                    placeholder="Nome da cliente"
                    value={novaCliente.nome}
                    onChange={e => setNovaCliente(nc => ({ ...nc, nome: e.target.value }))}
                  />
                  <Input
                    type="tel"
                    placeholder="WhatsApp (11) 9XXXX-XXXX"
                    value={novaCliente.telefone}
                    onChange={e => setNovaCliente(nc => ({ ...nc, telefone: e.target.value }))}
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
                    <ComboboxInput id="ag-cliente" placeholder="Buscar cliente..." />
                  </ComboboxInputGroup>
                  <ComboboxContent>
                    {(id: string) => (
                      <ComboboxItem key={id} value={id}>{clientes.find(c => c.id === id)?.nome}</ComboboxItem>
                    )}
                  </ComboboxContent>
                </Combobox>
              )}
            </div>

            {!editando && fila.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-brand-gold/40 bg-brand-surface-warm p-2.5">
                <p className="text-xs font-medium text-brand-terra">Procedimentos já adicionados ({fila.length})</p>
                {fila.map((item, i) => {
                  const svc = servicos.find(s => s.id === item.servico_id)
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{svc?.nome} · {format(new Date(item.data + 'T00:00:00'), 'dd/MM')} às {item.hora}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-medium">{formatCurrency(Number(item.valor_cobrado))}</span>
                        <button type="button" onClick={() => removerDaFila(i)} className="text-danger hover:opacity-70" title="Remover">
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="ag-servico">Serviço *{fila.length > 0 ? ` (procedimento ${fila.length + 1})` : ''}</Label>
              <Combobox
                items={servicos.map(s => s.id)}
                value={form.servico_id || null}
                onValueChange={onSelectServico}
                itemToStringLabel={(id: string) => servicos.find(s => s.id === id)?.nome ?? ''}
                filter={(id: string, query: string) => filtroServicos.contains(id, query, (v) => servicos.find(s => s.id === v)?.nome ?? '')}
                openOnInputClick
              >
                <ComboboxInputGroup>
                  <ComboboxInput id="ag-servico" placeholder="Buscar serviço..." />
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
                <Label htmlFor="ag-data">Data *</Label>
                <Input
                  id="ag-data"
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
                <Label htmlFor="ag-valor">Valor (R$) *</Label>
                <Input id="ag-valor" type="number" step="0.01" value={form.valor_cobrado} onChange={e => setForm(f => ({ ...f, valor_cobrado: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ag-status">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v ?? f.status }))}>
                  <SelectTrigger id="ag-status">
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
                <Label htmlFor="ag-forma-pagamento">Forma de pagamento</Label>
                <Select value={form.forma_pagamento} onValueChange={v => setForm(f => ({ ...f, forma_pagamento: v ?? '' }))}>
                  <SelectTrigger id="ag-forma-pagamento">
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
                  <Label htmlFor="ag-valor-pago">Valor já pago (R$)</Label>
                  <Input id="ag-valor-pago" type="number" step="0.01" value={form.valor_pago} onChange={e => setForm(f => ({ ...f, valor_pago: e.target.value }))} />
                </div>
              ) : form.status_pagamento === 'pendente' ? (
                <div className="space-y-2">
                  <Label htmlFor="ag-data-prometida">Data prometida</Label>
                  <Input id="ag-data-prometida" type="date" value={form.data_prevista_pagamento} onChange={e => setForm(f => ({ ...f, data_prevista_pagamento: e.target.value }))} />
                </div>
              ) : null}
            </div>
            {form.status_pagamento === 'parcial' && (
              <div className="space-y-2">
                <Label htmlFor="ag-data-restante">Data prevista pro restante</Label>
                <Input id="ag-data-restante" type="date" value={form.data_prevista_pagamento} onChange={e => setForm(f => ({ ...f, data_prevista_pagamento: e.target.value }))} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="ag-observacoes">Observações</Label>
              <Textarea id="ag-observacoes" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
            {!editando && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={!form.cliente_id || !linhaAtualCompleta}
                onClick={adicionarProcedimento}
              >
                <Plus className="h-4 w-4 mr-2" /> Adicionar outro procedimento pra essa cliente
              </Button>
            )}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={
                  salvando || !form.cliente_id ||
                  (editando
                    ? (!form.servico_id || !form.data || !form.hora)
                    : (fila.length === 0 && !linhaAtualCompleta))
                }
              >
                {salvando
                  ? 'Salvando...'
                  : editando
                  ? 'Salvar'
                  : fila.length + (linhaAtualCompleta ? 1 : 0) > 1
                  ? `Agendar ${fila.length + (linhaAtualCompleta ? 1 : 0)} procedimentos`
                  : 'Agendar'}
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
