'use client'

import { useEffect, useRef, useState } from 'react'
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
import { Plus, Edit, Trash2, CheckCircle, XCircle, MessageCircle, UserPlus, CalendarClock, Search, CircleDollarSign, Repeat, AlertTriangle, Gift } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, startOfDay, subDays, addDays, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Agendamento, Cliente, Servico } from '@/types'
import { diaFunciona, horariosDisponiveis, agendamentosParaOcupados, paraMinutos, HORARIO_FUNCIONAMENTO } from '@/lib/agenda'
import { formatCurrency } from '@/lib/format'
import { DIAS_PARA_CONFERIR, passouSemConferir } from '@/lib/presumido'
import { gravarCliente } from '@/lib/origem'
import { CampoOrigem } from '@/components/campo-origem'
import { HorariosLivres } from '@/components/horarios-livres-dialog'
import { sugerirProximaVisita, situacaoDaCliente, type ItemHistorico, type Sugestao } from '@/lib/proxima-visita'
import {
  STATUS_LABELS, STATUS_BADGE_VARIANT,
  FORMA_PAGAMENTO_LABELS, STATUS_PAGAMENTO_LABELS, STATUS_PAGAMENTO_BADGE_VARIANT,
} from '@/lib/status'
import { TAXA_CARTAO_DEBITO, taxaCartaoCredito, type CanalCartao } from '@/lib/taxas-cartao'
import { linkWhatsApp, mensagemConfirmacao, mensagemAgradecimento, mensagemConfirmacaoVarios } from '@/lib/whatsapp'

// 'local' saiu da UI em 01/08/2026 — Camila fechou o quartinho e o acordo com a Karine,
// hoje só atende no espaço próprio dela. Campo mantido fixo em 'quartinho' só pra bater
// com a constraint do banco (NOT NULL); "karine" existe só em dado histórico de abr-jun/2026.
// taxa_cartao_assumida_por começa em 'cliente' — é a taxa base (equivalente a 1x), a
// mais baixa das duas opções; só sobe pra taxa cheia do parcelamento se ela marcar
// ativamente "Eu assumo". Ver valorTaxaCartao() — mesmo com 'cliente', a taxa base
// nunca é zero (confirmado com caso real, ver memória do projeto).
const EMPTY_FORM = {
  cliente_id: '', servico_id: '', data: '', hora: '', status: 'agendado',
  local: 'quartinho', valor_cobrado: '', observacoes: '',
  forma_pagamento: '', status_pagamento: 'pendente', valor_pago: '', data_prevista_pagamento: '',
  parcelas: '1', taxa_cartao_assumida_por: 'cliente', valor_liquido_cartao: '', canal_cartao: 'maquininha',
}

// Promoção de inauguração — arredonda pra baixo (bate com a tabela divulgada).
// Vale só pra atendimentos com data até PROMO_FIM (combinado com a Camila) —
// não é sobre quando a promo é aplicada, é sobre a data do procedimento em si.
// Desligada em 25/09/2026: a validade venceu em 31/08 e o bloco continuava aparecendo
// em todo agendamento novo só pra dizer "essa data já passou da validade". Num formulário
// que já é longo, aviso que nunca vai ser útil de novo é atrito puro. Pra reativar numa
// próxima promoção, voltar pra true e ajustar PROMO_FIM/PROMO_LABEL.
const PROMO_ATIVA = false
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

/**
 * Agora, arredondado pra baixo na grade de 15 min e preso dentro do expediente.
 * Serve pro atalho "Atendi agora": o atendimento que acabou de acontecer começou
 * há pouco, não daqui a pouco.
 */
function horaAgoraNaGrade(): string {
  const d = new Date()
  const { grade, abertura, fechamento } = HORARIO_FUNCIONAMENTO
  const agora = Math.floor((d.getHours() * 60 + d.getMinutes()) / grade) * grade
  const preso = Math.min(
    Math.max(agora, paraMinutos(abertura)),
    paraMinutos(fechamento) - grade
  )
  return `${String(Math.floor(preso / 60)).padStart(2, '0')}:${String(preso % 60).padStart(2, '0')}`
}

type AcaoTipo = 'realizado' | 'pago' | 'cancelar' | 'excluir'

const NOVA_CLIENTE_VAZIA = { nome: '', telefone: '', origem: '', indicadaPor: '' }

// Tira de dias do formulário: 6 semanas a partir de hoje. Antes ia só até o fim do
// mês em exibição — no dia 28 sobravam 3 dias, justo quando ela marca a manutenção
// de cílios (21 dias) e a limpeza (35), que caem sempre no mês seguinte.
const DIAS_NA_TIRA = 42

/** Agendamento não cancelado de qualquer mês — histórico da cliente e ocupação da agenda. */
type ItemOcupacao = ItemHistorico & { servico?: { duracao_minutos?: number } | null }

export default function AgendamentosPage() {
  const supabase = createClient()
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  // Inclui inativos: o último serviço da cliente pode ter saído de linha e ainda
  // precisa ser reconhecido pra sugerir a continuação.
  const [todosServicos, setTodosServicos] = useState<Servico[]>([])
  const [historico, setHistorico] = useState<ItemOcupacao[]>([])
  const tiraDiasRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Agendamento | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  // Só muda o texto da tela: o formulário é o mesmo, o que muda é o que já vem preenchido.
  const [modoAgora, setModoAgora] = useState(false)
  /** Atendimentos cuja data já passou e que continuam como "agendado"/"confirmado". */
  const [pendencias, setPendencias] = useState<Agendamento[]>([])
  // Procedimentos já configurados nessa sessão do dialog, aguardando o clique em
  // "Agendar" pra serem todos criados juntos — permite marcar vários procedimentos
  // pra mesma cliente numa única confirmação, em vez de reabrir o dialog pra cada um.
  const [fila, setFila] = useState<(typeof EMPTY_FORM)[]>([])
  const [salvando, setSalvando] = useState(false)
  const [mesAtual, setMesAtual] = useState(new Date())
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(new Date())
  const [mostrarCancelados, setMostrarCancelados] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [buscaCliente, setBuscaCliente] = useState('')
  const [promo15, setPromo15] = useState(false)
  const [novaClienteAberta, setNovaClienteAberta] = useState(false)
  const [novaCliente, setNovaCliente] = useState(NOVA_CLIENTE_VAZIA)
  const [salvandoCliente, setSalvandoCliente] = useState(false)
  const [acao, setAcao] = useState<{ tipo: AcaoTipo; ag: Agendamento } | null>(null)
  const [processandoAcao, setProcessandoAcao] = useState(false)

  useEffect(() => {
    loadData()
  }, [mesAtual])

  async function loadData() {
    setLoading(true)
    const inicio = startOfMonth(mesAtual).toISOString()
    const fim = endOfMonth(mesAtual).toISOString()

    const [{ data: ags }, { data: cls }, { data: svs }, { data: pend }, { data: hist }, { data: todosSvs }] = await Promise.all([
      supabase.from('agendamentos')
        .select('*, cliente:clientes(id, nome, telefone), servico:servicos(id, nome, preco, duracao_minutos)')
        .gte('data_hora', inicio).lte('data_hora', fim)
        .order('data_hora'),
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
      // Consulta própria, sem recorte de mês: o atendimento esquecido não fica só no
      // mês que ela está olhando, e era exatamente esse o buraco — em 25/09 havia
      // R$ 1.107 de setembro inteiro sem nenhum atendimento fechado, então o
      // financeiro mostrava R$ 0 recebido e "-100% vs mês anterior".
      supabase.from('agendamentos')
        .select('*, cliente:clientes(id, nome, telefone), servico:servicos(id, nome)')
        .lt('data_hora', new Date().toISOString())
        .in('status', ['agendado', 'confirmado'])
        .order('data_hora'),
      // Todos os meses, só o essencial. Duas funções: (1) checar conflito de horário
      // em qualquer data — antes só o mês aberto na tela era carregado, então marcar
      // dia 05/11 olhando outubro mostrava como livre um horário já ocupado; e
      // (2) saber o último atendimento da cliente pra sugerir o próximo.
      supabase.from('agendamentos')
        .select('id, cliente_id, servico_id, data_hora, status, servico:servicos(duracao_minutos)')
        .neq('status', 'cancelado'),
      supabase.from('servicos').select('*'),
    ])

    setAgendamentos((ags as any) ?? [])
    setHistorico((hist as unknown as ItemOcupacao[]) ?? [])
    setTodosServicos(todosSvs ?? [])
    setClientes(cls ?? [])
    setServicos(svs ?? [])
    setPendencias((pend as unknown as Agendamento[]) ?? [])
    setLoading(false)
  }

  function abrirNovo(data?: Date) {
    setEditando(null)
    setModoAgora(false)
    // Data já vem preenchida com hoje: sem ela o seletor de horário abre travado
    // ("escolhe o serviço e a data primeiro") e obriga um toque a mais em todo
    // agendamento. Hoje é o caso mais comum; trocar é um toque, digitar é dois.
    setForm({ ...EMPTY_FORM, data: format(data ?? new Date(), 'yyyy-MM-dd') })
    setFila([])
    setPromo15(false)
    setNovaClienteAberta(false)
    setNovaCliente(NOVA_CLIENTE_VAZIA)
    setDialogOpen(true)
  }

  /**
   * Atalho pro atendimento que ACABOU de acontecer, sem ter sido agendado antes.
   *
   * Esse é o caso que mais escapa: a Camila atende, a cliente vai embora e o
   * lançamento fica pra depois — e depois vira nunca. Pelo caminho normal ela teria
   * que escolher a data, caçar o horário que já passou no meio de 50 e poucos chips,
   * trocar o status pra "realizado" e ainda marcar o pagamento. Aqui tudo isso já
   * vem pronto: sobra escolher a cliente e o procedimento.
   */
  function abrirAtendimentoAgora() {
    setEditando(null)
    setModoAgora(true)
    setForm({
      ...EMPTY_FORM,
      data: format(new Date(), 'yyyy-MM-dd'),
      hora: horaAgoraNaGrade(),
      status: 'realizado',
      // Atendimento de balcão quase sempre é pago na hora. Fica visível no formulário
      // pra ela trocar quando não for — e resolve o esquecimento crônico de marcar
      // como pago depois, que é o que deixa o financeiro errado.
      status_pagamento: 'pago',
    })
    setFila([])
    setPromo15(false)
    setNovaClienteAberta(false)
    setNovaCliente(NOVA_CLIENTE_VAZIA)
    setDialogOpen(true)
  }

  function abrirEditar(ag: Agendamento) {
    setEditando(ag)
    setModoAgora(false)
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
      parcelas: ag.parcelas != null ? String(ag.parcelas) : '1',
      taxa_cartao_assumida_por: ag.taxa_cartao_assumida_por ?? 'cliente',
      valor_liquido_cartao: '', canal_cartao: 'maquininha',
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

  // Horários possíveis pro serviço+data escolhidos, descontando conflitos existentes
  // (agendamentos já salvos + procedimentos já empilhados na fila). Ao editar, o
  // próprio agendamento não conta como conflito consigo mesmo. Extraída como função
  // (em vez de só o valor memoizado) porque também é usada pra sugerir automaticamente
  // o próximo horário livre ao adicionar o 2º+ procedimento — ver onSelectServico.
  function horariosParaServicoData(servicoId: string, data: string): string[] {
    if (!servicoId || !data) return []
    const duracao = servicos.find(s => s.id === servicoId)?.duracao_minutos ?? 60
    const dataObj = new Date(data + 'T00:00:00')
    const ocupados = agendamentosParaOcupados([
      ...historico.filter(ag =>
        ag.id !== editando?.id &&
        isSameDay(new Date(ag.data_hora), dataObj)
      ),
      ...filaComoOcupados(data),
    ])
    return horariosDisponiveis({ duracaoMinutos: duracao, ocupados })
  }

  const servicoEscolhido = servicos.find(s => s.id === form.servico_id)
  const horariosDoServico = horariosParaServicoData(form.servico_id, form.data)

  // Tira rápida de dias, pra escolher a data sem abrir o calendário nativo. Começa
  // hoje (ou no mês em exibição, se ela navegou pra frente) e cobre DIAS_NA_TIRA.
  const diasParaEscolher = (() => {
    const hoje = startOfDay(new Date())
    const inicioMes = startOfMonth(mesAtual)
    const inicio = isBefore(inicioMes, hoje) ? hoje : inicioMes
    return eachDayOfInterval({ start: inicio, end: addDays(inicio, DIAS_NA_TIRA - 1) })
  })()

  // Data escolhida (à mão ou pela sugestão) pode estar semanas à frente, fora da
  // parte visível da tira — centraliza o dia marcado pra ela ver o que foi escolhido.
  useEffect(() => {
    const tira = tiraDiasRef.current
    const marcado = tira?.querySelector<HTMLElement>('[data-selecionado="true"]')
    if (tira && marcado) tira.scrollLeft = marcado.offsetLeft - tira.clientWidth / 2 + marcado.clientWidth / 2
  }, [form.data, dialogOpen])

  // Só em agendamento novo e antes de ela escolher o serviço: depois disso a
  // sugestão já não ajuda e só ocuparia espaço no formulário.
  const situacaoCliente = !editando && form.cliente_id ? situacaoDaCliente(form.cliente_id, historico) : null
  const sugestao = situacaoCliente && !situacaoCliente.proximo && fila.length === 0 && !form.servico_id
    ? sugerirProximaVisita(form.cliente_id, historico, todosServicos, servicos)
    : null

  // Cliente que trouxe alguém nos últimos 60 dias: lembra a Camila na próxima vez
  // que for marcar essa cliente — é o momento natural de agradecer (e dar o mimo,
  // se ela decidir ter um). Sem isso a indicação acontece e ninguém reconhece.
  const indicacoesRecentes = !editando && form.cliente_id
    ? clientes.filter(c => c.indicada_por === form.cliente_id && differenceInDays(new Date(), new Date(c.created_at)) <= 60)
    : []

  function aplicarSugestao(s: Sugestao) {
    // No "Atendi agora" data e hora já são o agora — a sugestão só traz o serviço.
    if (modoAgora) {
      setForm(f => ({ ...f, servico_id: s.servico.id, valor_cobrado: String(s.servico.preco) }))
      return
    }
    const data = s.data ?? form.data
    const livres = horariosParaServicoData(s.servico.id, data)
    // Horário de sempre ocupado nesse dia: o mais próximo depois dele, senão o
    // primeiro livre. Avisa, pra ela não confirmar com a cliente o horário antigo.
    const hora = livres.includes(s.hora)
      ? s.hora
      : livres.find(h => paraMinutos(h) >= paraMinutos(s.hora)) ?? livres[0] ?? ''
    if (hora && hora !== s.hora) toast.info(`${s.hora} já está ocupado nesse dia — sugeri ${hora}.`)
    setForm(f => ({ ...f, servico_id: s.servico.id, data, hora, valor_cobrado: String(s.servico.preco) }))
  }

  function horariosLivresNoDia(dia: Date) {
    if (!servicoEscolhido) return diaFunciona(dia)
    const ocupados = agendamentosParaOcupados([
      ...historico.filter(ag =>
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
    const trocouServico = id !== form.servico_id
    // Do 2º procedimento da fila em diante, sugere o horário logo depois que o ÚLTIMO
    // procedimento já empilhado termina (não o primeiro horário livre do dia inteiro —
    // isso ia sugerir um furo antes, tipo 07:00, em vez de encadear). Ela ainda pode
    // trocar o horário sugerido se quiser.
    const horaSugerida = (() => {
      if (!trocouServico || fila.length === 0 || !form.data) return undefined
      const itensNoDia = fila.filter(item => item.data === form.data)
      if (itensNoDia.length === 0) return undefined
      const ultimo = itensNoDia[itensNoDia.length - 1]
      const duracaoUltimo = servicos.find(s => s.id === ultimo.servico_id)?.duracao_minutos ?? 60
      const fimUltimoMin = paraMinutos(ultimo.hora) + duracaoUltimo
      const disponiveis = horariosParaServicoData(id, form.data)
      return disponiveis.find(h => paraMinutos(h) >= fimUltimoMin) ?? disponiveis[0]
    })()
    // Duração muda com o serviço, então o horário escolhido pode não caber mais (passar
    // do fechamento ou bater em outro agendamento). Antes isso limpava o horário SEMPRE
    // que trocava o serviço — o que apagava o horário já preenchido pelo "Atendi agora"
    // e também obrigava a reescolher à toa quando o horário continuava válido. Agora só
    // limpa quando de fato não cabe mais.
    const horaAindaCabe =
      !!form.hora && id !== '' && horariosParaServicoData(id, form.data).includes(form.hora)

    setForm(f => ({
      ...f,
      servico_id: id,
      hora: horaSugerida ?? (trocouServico && !horaAindaCabe ? '' : f.hora),
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
    const { data, error } = await gravarCliente(supabase, {
      nome: novaCliente.nome.trim(),
      telefone: novaCliente.telefone,
      origem: novaCliente.origem || null,
      indicada_por: novaCliente.origem === 'indicacao' && novaCliente.indicadaPor ? novaCliente.indicadaPor : null,
    })
    setSalvandoCliente(false)
    if (error || !data) { toast.error('Erro ao cadastrar cliente'); return }
    setClientes(cs => [...cs, data].sort((a, b) => a.nome.localeCompare(b.nome)))
    setForm(f => ({ ...f, cliente_id: data.id }))
    setNovaCliente(NOVA_CLIENTE_VAZIA)
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
      parcelas: f.forma_pagamento === 'cartao_credito' ? Number(f.parcelas || 1) : null,
      taxa_cartao_assumida_por: f.forma_pagamento === 'cartao_credito' ? (f.taxa_cartao_assumida_por as 'cliente' | 'profissional') : null,
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
      parcelas: '1', taxa_cartao_assumida_por: 'cliente', valor_liquido_cartao: '', canal_cartao: 'maquininha',
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
          const valorLiquidoCartao = form.forma_pagamento === 'cartao_credito' && form.valor_liquido_cartao
            ? Number(form.valor_liquido_cartao) : null
          if (valor > 0) await registrarEntradaFinanceira(editando.id, { ...payload, valor_liquido_cartao: valorLiquidoCartao, canal_cartao: form.canal_cartao }, valor)
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
          // `data` (retorno do insert) só tem colunas do banco — valor_liquido_cartao
          // não é persistido, então pareia por posição com `linhas` (mesma ordem do
          // insert) pra recuperar o que ela digitou no formulário de cada linha.
          for (let i = 0; i < data.length; i++) {
            const row: any = data[i]
            if (row.status === 'realizado') {
              const valor = valorRecebidoAoRealizar(row.status_pagamento, row.valor_cobrado, row.valor_pago)
              const linha = linhas[i]
              const valorLiquidoCartao = linha?.forma_pagamento === 'cartao_credito' && linha.valor_liquido_cartao
                ? Number(linha.valor_liquido_cartao) : null
              if (valor > 0) await registrarEntradaFinanceira(row.id, { ...row, valor_liquido_cartao: valorLiquidoCartao, canal_cartao: linha?.canal_cartao }, valor)
            }
          }
        }
        const mensagem = payloads.length > 1 ? `${payloads.length} procedimentos agendados!` : 'Agendamento criado!'
        // Ela marca com o WhatsApp da cliente aberto do lado — o passo seguinte é
        // sempre responder confirmando. O botão leva a mensagem pronta, com data,
        // valor e endereço, em vez de ela digitar tudo de novo.
        const cliente = clientes.find(c => c.id === form.cliente_id)
        const tudoFuturo = linhas.every(l => l.status === 'agendado' || l.status === 'confirmado')
        if (cliente?.telefone && tudoFuturo) {
          const texto = mensagemConfirmacaoVarios(cliente.nome, linhas.map(l => ({
            servico: servicos.find(sv => sv.id === l.servico_id)?.nome ?? 'procedimento',
            dataHora: new Date(`${l.data}T${l.hora}:00`),
            valor: Number(l.valor_cobrado),
          })))
          toast.success(mensagem, {
            duration: 15000,
            action: { label: 'Confirmar no WhatsApp', onClick: () => window.open(linkWhatsApp(cliente.telefone, texto), '_blank') },
          })
        } else {
          toast.success(mensagem)
        }
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

  // Quanto some do valor recebido por causa da taxa. No débito é sempre custo da Camila
  // (só existe físico, na maquininha). No crédito, a taxa "base" (equivalente a 1x) É
  // SEMPRE custo dela — mesmo quando a cliente assume o parcelamento (aí ela só cobre o
  // juros extra, pagando um pouco mais em cada parcela; a base continua sendo da Camila).
  // Maquininha física e link de pagamento (cobrança online) têm tabelas de taxa
  // diferentes — a InfinitePay cobra mais no link (confirmado com caso real: venda paga
  // por link saiu bem mais cara que uma equivalente na maquininha).
  function valorTaxaCartao(formaPagamento: string | null, valorRecebido: number, parcelas: number | null, assumidaPor: string | null, canal: CanalCartao = 'maquininha') {
    if (valorRecebido <= 0) return 0
    if (formaPagamento === 'cartao_debito') return valorRecebido * TAXA_CARTAO_DEBITO / 100
    if (formaPagamento === 'cartao_credito') {
      const taxa = assumidaPor === 'profissional' ? taxaCartaoCredito(parcelas ?? 1, canal) : taxaCartaoCredito(1, canal)
      return valorRecebido * taxa / 100
    }
    return 0
  }

  async function registrarEntradaFinanceira(agendamentoId: string, payload: any, valor: number) {
    const cliente = clientes.find(c => c.id === payload.cliente_id)
    const servico = servicos.find(s => s.id === payload.servico_id)
    const desc = `${servico?.nome ?? 'Serviço'} - ${cliente?.nome ?? 'Cliente'}`
    const data = format(new Date(payload.data_hora), 'yyyy-MM-dd')
    await supabase.from('lancamentos').insert({
      tipo: 'entrada',
      descricao: desc,
      valor,
      categoria: 'Serviço',
      data,
      agendamento_id: agendamentoId,
    })

    // Se ela conferiu o valor líquido exato na maquininha e ajustou manualmente, usa
    // esse número (mais preciso que a estimativa — a InfinitePay tem uma lógica própria
    // de repasse de juros de parcelamento pro cliente que a tabela de % não replica
    // exatamente). Senão, cai pra estimativa automática.
    const taxa = payload.valor_liquido_cartao != null
      ? Math.max(valor - payload.valor_liquido_cartao, 0)
      : valorTaxaCartao(payload.forma_pagamento, valor, payload.parcelas, payload.taxa_cartao_assumida_por, payload.canal_cartao)
    if (taxa >= 0.01) {
      const parcelasTag = payload.forma_pagamento === 'cartao_credito' && Number(payload.parcelas) > 1 ? ` ${payload.parcelas}x` : ''
      const canalTag = payload.canal_cartao === 'link' ? ' (link)' : ''
      await supabase.from('lancamentos').insert({
        tipo: 'saida',
        descricao: `Taxa de cartão${parcelasTag}${canalTag} - ${desc}`,
        valor: Number(taxa.toFixed(2)),
        categoria: 'Taxa de Cartão',
        data,
        agendamento_id: agendamentoId,
      })
    }
  }

  async function confirmarAcao() {
    // Trava contra clique duplo (comum no celular, tocar 2x esperando resposta) —
    // sem isso, dois cliques rápidos no "Confirmar" disparavam duas chamadas antes da
    // primeira terminar, cada uma lançando sua própria entrada no financeiro e
    // duplicando o valor recebido pro mesmo atendimento.
    if (!acao || processandoAcao) return
    const { tipo, ag } = acao
    setProcessandoAcao(true)

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
    } else if (tipo === 'pago') {
      // Atendimento já realizado que ficou com pagamento em aberto. Antes só dava pra
      // resolver abrindo "Editar detalhes" e mexendo no formulário inteiro — por isso
      // tanta coisa ficava marcada como pendente e o financeiro nunca fechava.
      //
      // O valor lançado é o que FALTA, calculado a partir do que já entrou no
      // financeiro por esse agendamento — e não a partir do status. Assim um parcial
      // que já lançou a entrada não lança o valor cheio de novo.
      const { data: jaLancado } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('agendamento_id', ag.id)
        .eq('tipo', 'entrada')
      const jaRecebido = (jaLancado ?? []).reduce(
        (s: number, l: { valor: number | string }) => s + Number(l.valor),
        0
      )
      const falta = Number((Number(ag.valor_cobrado) - jaRecebido).toFixed(2))

      const { error } = await supabase
        .from('agendamentos')
        .update({ status_pagamento: 'pago', valor_pago: null, data_prevista_pagamento: null })
        .eq('id', ag.id)

      if (error) {
        toast.error('Erro ao marcar como pago')
      } else {
        if (falta > 0) await registrarEntradaFinanceira(ag.id, ag, falta)
        toast.success(
          falta > 0
            ? `Recebido! ${formatCurrency(falta)} lançado no financeiro.`
            : 'Marcado como pago.'
        )
        loadData()
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
    setProcessandoAcao(false)
    setAcao(null)
  }

  const diasDoMes = eachDayOfInterval({ start: startOfMonth(mesAtual), end: endOfMonth(mesAtual) })
  // Corte de "essa semana" do card de pendências (lib/presumido.ts explica o porquê).
  const limiteConferir = subDays(new Date(), DIAS_PARA_CONFERIR)
  const pendenciasRecentes = pendencias.filter(ag => new Date(ag.data_hora) >= limiteConferir)
  const pendenciasAntigas = pendencias.filter(ag => new Date(ag.data_hora) < limiteConferir)
  const buscaAtiva = buscaCliente.trim().toLowerCase()
  const agendamentosDoDiaTodos = diaSelecionado
    ? agendamentos
        .filter(ag => isSameDay(new Date(ag.data_hora), diaSelecionado))
        .filter(ag => !buscaAtiva || (ag as any).cliente?.nome?.toLowerCase().includes(buscaAtiva))
    : []
  // Cancelados ficam escondidos da timeline por padrão — misturados com os ativos eles
  // confundem a leitura rápida do dia (parece que o horário tá ocupado quando não tá
  // mais). Continuam a um clique de distância pra quem quiser conferir o histórico.
  const agendamentosDoDiaCancelados = agendamentosDoDiaTodos.filter(ag => ag.status === 'cancelado')
  const agendamentosDoDia = mostrarCancelados
    ? agendamentosDoDiaTodos
    : agendamentosDoDiaTodos.filter(ag => ag.status !== 'cancelado')

  const hojeAgendamentos = agendamentos.filter(ag => ag.status !== 'cancelado' && isSameDay(new Date(ag.data_hora), new Date()))
  const hojeConfirmados = hojeAgendamentos.filter(ag => ag.status === 'confirmado' || ag.status === 'realizado').length
  const hojeAguardando = hojeAgendamentos.filter(ag => ag.status === 'agendado').length

  const agendamentosFiltrados = agendamentos
    .filter(ag => filtroStatus === 'todos' || ag.status === filtroStatus)
    .filter(ag => !buscaCliente.trim() || (ag as any).cliente?.nome?.toLowerCase().includes(buscaCliente.trim().toLowerCase()))

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-brand-dark tracking-wide">Agendamentos</h1>
          <p className="text-muted-foreground">{format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
        {/* Dois caminhos de propósito: marcar o que vem (agendamento) e lançar o que
            acabou de acontecer (atendimento). O segundo é o que mais escapava. */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={abrirAtendimentoAgora} className="flex-1 sm:flex-none">
            <CheckCircle className="h-4 w-4 mr-2" /> Atendi agora
          </Button>
          <Button onClick={() => abrirNovo()} className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Desde 15/10 isto não é mais "feche cada um": o que passou já conta como
          atendido e pago (lib/presumido.ts), porque ela não voltava pra fechar — a
          lista chegou a 64 itens e R$ 6.456, crescendo toda semana sem um toque.
          Agora o card só pergunta o que ela ainda lembra: quem faltou nos últimos
          dias. O mais antigo fica presumido em silêncio, com uma linha de total. */}
      {pendenciasRecentes.length > 0 && (
        <Card className="border-brand-terra bg-brand-surface-warm">
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-brand-terra" />
              Alguém faltou essa semana?
            </CardTitle>
            <p className="text-sm text-brand-text-soft">
              Já contei estes como atendidos e pagos. Só toca em quem não veio.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...pendenciasRecentes].reverse().map(ag => (
              <div key={ag.id} className="rounded-lg border border-brand-border bg-brand-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-dark">{ag.cliente?.nome}</p>
                    <p className="truncate text-xs text-brand-muted">
                      {ag.servico?.nome} · {format(new Date(ag.data_hora), "EEEEEE dd/MM, HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-dark">
                    {formatCurrency(Number(ag.valor_cobrado))}
                  </span>
                </div>
                <div className="mt-2.5 flex gap-2">
                  {/* O card mostra quem foi atendida nos últimos dias — o melhor momento
                      pra agradecer e pedir avaliação no Google, com a experiência fresca. */}
                  {ag.cliente?.telefone && (
                    <Button
                      size="sm" variant="outline" className="shrink-0 px-2.5 text-success"
                      title="Agradecer e pedir avaliação no WhatsApp"
                      onClick={() => window.open(
                        linkWhatsApp(ag.cliente!.telefone, mensagemAgradecimento(ag.cliente!.nome, ag.servico?.nome ?? 'seu procedimento')),
                        '_blank'
                      )}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm" variant="outline" className="flex-1 text-danger"
                    onClick={() => setAcao({ tipo: 'cancelar', ag })}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" /> Não veio
                  </Button>
                  {/* Opcional: grava de vez como realizado e lança no financeiro. Fica
                      em segundo plano porque o número já está certo sem ele. */}
                  <Button
                    size="sm" variant="ghost" className="flex-1 text-brand-text-soft"
                    onClick={() => setAcao({ tipo: 'realizado', ag })}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Veio
                  </Button>
                </div>
              </div>
            ))}
            {pendenciasAntigas.length > 0 && (
              <p className="pt-1 text-xs text-brand-muted">
                Mais {pendenciasAntigas.length} de antes disso
                ({formatCurrency(pendenciasAntigas.reduce((s, ag) => s + Number(ag.valor_cobrado), 0))}) já
                contam como atendidos.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Agenda vazia é faturamento que não volta: em out/2026 ela ocupava ~30% do
          tempo. O botão transforma o que está livre em texto pra status/stories. */}
      <HorariosLivres ocupacao={historico} />

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
                        {ag.forma_pagamento === 'cartao_credito' && Number(ag.parcelas) > 1 && ` ${ag.parcelas}x`}
                        {ag.forma_pagamento === 'cartao_credito' && ag.taxa_cartao_assumida_por === 'profissional' && ' (parcelamento: Camila)'}
                      </p>
                      <div className="flex gap-1 mt-2">
                        {ag.status !== 'realizado' && ag.status !== 'cancelado' && (
                          <Button size="sm" variant="outline" className="text-success h-7 px-2 text-xs" onClick={() => setAcao({ tipo: 'realizado', ag })}>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Realizado
                          </Button>
                        )}
                        {/* Atendimento feito mas com pagamento em aberto: até aqui só dava
                            pra resolver abrindo o formulário inteiro, e por isso quase nunca
                            era resolvido. */}
                        {ag.status === 'realizado' && ag.status_pagamento !== 'pago' && (
                          <Button size="sm" variant="outline" className="text-success h-7 px-2 text-xs" onClick={() => setAcao({ tipo: 'pago', ag })}>
                            <CircleDollarSign className="h-3.5 w-3.5 mr-1" /> Recebi
                          </Button>
                        )}
                        {ag.cliente?.telefone && ag.status !== 'cancelado' && (
                          <Button
                            size="sm" variant="outline"
                            className="text-success h-7 px-2"
                            title={ag.status === 'realizado' || passouSemConferir(ag) ? 'Agradecer e pedir avaliação no WhatsApp' : 'Enviar confirmação no WhatsApp'}
                            onClick={() => window.open(
                              linkWhatsApp(
                                ag.cliente.telefone,
                                // Já aconteceu (fechado ou não): a mensagem certa é o
                                // agradecimento. Antes só "realizado" contava — e como ela
                                // não fecha atendimento, o agradecimento nunca saía.
                                ag.status === 'realizado' || passouSemConferir(ag)
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
                  onClick={() => { setDiaSelecionado(new Date()); setMostrarCancelados(false) }}
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
                    onClick={() => { setDiaSelecionado(selecionado ? null : dia); setMostrarCancelados(false) }}
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
                <CardContent className="space-y-2">
                  {agendamentosDoDiaCancelados.length > 0 && (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() => setMostrarCancelados(v => !v)}
                    >
                      {mostrarCancelados ? 'Ocultar' : 'Mostrar'} {agendamentosDoDiaCancelados.length} cancelado{agendamentosDoDiaCancelados.length > 1 ? 's' : ''}
                    </button>
                  )}
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

      {/* Atalho fixo no celular: os botões do topo somem assim que ela rola a agenda,
          e é no celular, entre um atendimento e outro, que o lançamento precisa
          acontecer. Some quando o formulário está aberto pra não cobrir o dialog. */}
      {!dialogOpen && (
        <button
          type="button"
          onClick={abrirAtendimentoAgora}
          className="fixed right-4 z-40 flex items-center gap-2 rounded-full bg-brand-medium px-5 py-3.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-brand-medium-hover sm:hidden"
          style={{ bottom: `calc(1rem + env(safe-area-inset-bottom, 0px))` }}
        >
          <CheckCircle className="h-4 w-4" /> Atendi agora
        </button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar Agendamento' : modoAgora ? 'Atendimento de agora' : 'Novo Agendamento'}
            </DialogTitle>
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
                  {/* Aqui é onde cliente nova nasce de verdade (no meio do agendamento),
                      então é aqui que a origem precisa ser perguntada. */}
                  <CampoOrigem
                    origem={novaCliente.origem}
                    indicadaPor={novaCliente.indicadaPor}
                    onChange={v => setNovaCliente(nc => ({ ...nc, ...v }))}
                    clientes={clientes}
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
              {situacaoCliente?.proximo && !novaClienteAberta && (
                <p className="flex items-start gap-1.5 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span>
                    Já tem horário marcado: {todosServicos.find(sv => sv.id === situacaoCliente.proximo!.servico_id)?.nome ?? 'procedimento'}{' '}
                    {format(new Date(situacaoCliente.proximo.data_hora), "EEEEEE dd/MM 'às' HH:mm", { locale: ptBR })}.
                  </span>
                </p>
              )}
              {indicacoesRecentes.length > 0 && !novaClienteAberta && (
                <p className="flex items-start gap-1.5 rounded-lg bg-success-soft px-3 py-2 text-xs text-success">
                  <Gift className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span>Indicou {indicacoesRecentes.map(c => c.nome.split(' ')[0]).join(', ')} — lembra de agradecer!</span>
                </p>
              )}
              {sugestao && !novaClienteAberta && (
                <button
                  type="button"
                  onClick={() => aplicarSugestao(sugestao)}
                  className="w-full rounded-lg border border-brand-gold bg-brand-surface-warm p-3 text-left transition-colors hover:border-primary"
                >
                  <span className="block text-xs text-brand-muted">
                    Última vez: {sugestao.ultimoServicoNome} · {format(sugestao.ultimaVisita, 'dd/MM')} (há {differenceInDays(new Date(), sugestao.ultimaVisita)} dias)
                  </span>
                  <span className="mt-1 flex items-start gap-1.5 text-sm font-medium text-brand-dark">
                    <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      Marcar {sugestao.servico.nome}
                      {!modoAgora && sugestao.data && ` · ${format(new Date(sugestao.data + 'T00:00:00'), 'EEEEEE dd/MM', { locale: ptBR })}`}
                      {!modoAgora && ` às ${sugestao.hora}`}
                    </span>
                  </span>
                </button>
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
                <div ref={tiraDiasRef} className="relative flex gap-1.5 overflow-x-auto pb-1">
                  {diasParaEscolher.map(dia => {
                    const valorDia = format(dia, 'yyyy-MM-dd')
                    const selecionado = form.data === valorDia
                    const fechado = !diaFunciona(dia)
                    const livre = !fechado && horariosLivresNoDia(dia)
                    return (
                      <button
                        key={valorDia}
                        type="button"
                        data-selecionado={selecionado}
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
              {/* Campo de digitar ao lado do rótulo: a grade de 15 min entre 07h e 20h
                  gera mais de 50 chips, e caçar "14:00" rolando essa parede no celular
                  é justamente o tipo de atrito que faz o lançamento ficar pra depois.
                  Quem sabe a hora digita; quem quer ver o que está livre usa os chips. */}
              <div className="flex items-center justify-between">
                <Label>Horário *</Label>
                <Input
                  type="time"
                  step={HORARIO_FUNCIONAMENTO.grade * 60}
                  value={form.hora}
                  onChange={e => setForm(f => ({ ...f, hora: e.target.value }))}
                  className="h-8 w-auto text-xs"
                  aria-label="Digitar horário"
                />
              </div>
              {!form.servico_id || !form.data ? (
                <p className="text-xs text-muted-foreground">
                  {form.hora
                    ? `Horário ${form.hora} já preenchido — escolha o serviço pra confirmar que cabe na agenda.`
                    : 'Escolha o serviço e a data primeiro.'}
                </p>
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
            {form.forma_pagamento === 'cartao_debito' && (
              <p className="text-xs text-brand-muted-soft -mt-1">
                Taxa da maquininha ({TAXA_CARTAO_DEBITO}%) descontada automaticamente no financeiro.
              </p>
            )}
            {form.forma_pagamento === 'cartao_credito' && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-brand-border bg-brand-surface p-3">
                <div className="space-y-2">
                  <Label htmlFor="ag-parcelas">Parcelas</Label>
                  <Select value={form.parcelas} onValueChange={v => setForm(f => ({ ...f, parcelas: v ?? f.parcelas }))}>
                    <SelectTrigger id="ag-parcelas"><SelectValue>{form.parcelas}x</SelectValue></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                        <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quem assume o parcelamento?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button" size="sm"
                      variant={form.taxa_cartao_assumida_por === 'cliente' ? 'default' : 'outline'}
                      onClick={() => setForm(f => ({ ...f, taxa_cartao_assumida_por: 'cliente' }))}
                    >
                      Cliente
                    </Button>
                    <Button
                      type="button" size="sm"
                      variant={form.taxa_cartao_assumida_por === 'profissional' ? 'default' : 'outline'}
                      onClick={() => setForm(f => ({ ...f, taxa_cartao_assumida_por: 'profissional' }))}
                    >
                      Eu
                    </Button>
                  </div>
                  <p className="text-[11px] text-brand-muted-soft">
                    A taxa base do cartão é sempre sua — isso aqui é só sobre quem paga o juro
                    extra de parcelar (se for a cliente, ela paga um pouco mais em cada parcela).
                  </p>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Cobrado por</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button" size="sm"
                      variant={form.canal_cartao === 'maquininha' ? 'default' : 'outline'}
                      onClick={() => setForm(f => ({ ...f, canal_cartao: 'maquininha' }))}
                    >
                      Maquininha
                    </Button>
                    <Button
                      type="button" size="sm"
                      variant={form.canal_cartao === 'link' ? 'default' : 'outline'}
                      onClick={() => setForm(f => ({ ...f, canal_cartao: 'link' }))}
                    >
                      Link de pagamento
                    </Button>
                  </div>
                  <p className="text-[11px] text-brand-muted-soft">
                    Taxa diferente pra cada canal — link de pagamento (cobrança online) é mais
                    caro que passar na maquininha física.
                  </p>
                </div>
                {form.valor_cobrado && (() => {
                  const canal = form.canal_cartao as CanalCartao
                  const taxaPct = form.taxa_cartao_assumida_por === 'profissional'
                    ? taxaCartaoCredito(Number(form.parcelas || 1), canal) : taxaCartaoCredito(1, canal)
                  const taxaEstimada = Number(form.valor_cobrado) * taxaPct / 100
                  const liquidoEstimado = Number(form.valor_cobrado) - taxaEstimada
                  return (
                    <div className="col-span-2 space-y-2">
                      <p className="text-xs text-brand-muted-soft">
                        Estimativa: taxa de {formatCurrency(taxaEstimada)} ({taxaPct}%) — você recebe {formatCurrency(liquidoEstimado)} líquido.
                      </p>
                      <div className="space-y-1">
                        <Label htmlFor="ag-valor-liquido" className="text-xs">
                          Conferiu na maquininha? Ajusta o valor líquido aqui (opcional)
                        </Label>
                        <Input
                          id="ag-valor-liquido" type="number" step="0.01" min="0"
                          placeholder={liquidoEstimado.toFixed(2)}
                          value={form.valor_liquido_cartao}
                          onChange={e => setForm(f => ({ ...f, valor_liquido_cartao: e.target.value }))}
                        />
                      </div>
                    </div>
                  )
                })()}
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
              {editando && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-danger px-3"
                  title="Excluir agendamento"
                  onClick={() => { setDialogOpen(false); setAcao({ tipo: 'excluir', ag: editando }) }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
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
              {acao?.tipo === 'pago' && `Recebeu o pagamento de "${acao.ag.cliente?.nome}"?`}
              {/* Horário que já passou: cancelar aqui é registrar falta, não liberar agenda. */}
              {acao?.tipo === 'cancelar' && (new Date(acao.ag.data_hora) < new Date()
                ? `${acao.ag.cliente?.nome ?? 'A cliente'} não veio?`
                : 'Cancelar agendamento?')}
              {acao?.tipo === 'excluir' && 'Excluir agendamento?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {acao?.tipo === 'realizado' && `Isso lança ${formatCurrency(Number(acao.ag.valor_cobrado))} automaticamente no Financeiro.`}
              {acao?.tipo === 'pago' && 'Lança no Financeiro o que ainda faltava desse atendimento.'}
              {acao?.tipo === 'cancelar' && (new Date(acao.ag.data_hora) < new Date()
                ? `Os ${formatCurrency(Number(acao.ag.valor_cobrado))} saem das Entradas do mês.`
                : 'O horário volta a ficar disponível pra outra cliente.')}
              {acao?.tipo === 'excluir' && 'Essa ação remove o registro e não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processandoAcao}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant={acao?.tipo === 'realizado' || acao?.tipo === 'pago' ? 'default' : 'destructive'}
              onClick={confirmarAcao}
              disabled={processandoAcao}
            >
              {processandoAcao ? 'Confirmando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
