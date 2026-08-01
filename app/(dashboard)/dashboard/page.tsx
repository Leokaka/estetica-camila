'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DollarSign, Users, TrendingUp, TrendingDown,
  Gift, AlertCircle, Scissors, CalendarCheck, CheckCircle2, MessageCircle, CircleDollarSign,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths, differenceInDays, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { Agendamento, Cliente } from '@/types'
import { formatCurrency } from '@/lib/format'
import { STATUS_LABELS, STATUS_BADGE_VARIANT } from '@/lib/status'
import { linkWhatsApp, mensagemConfirmacao } from '@/lib/whatsapp'
import { toast } from 'sonner'

function mensagemCobranca(nome: string, servico: string, valor: number) {
  return `Oi, ${nome.split(' ')[0]}! Aqui é a Camila 💛\n\nPassando só pra lembrar do pagamento do ${servico} (${formatCurrency(valor)}) combinado. Qualquer coisa me chama por aqui 😊`
}

function mensagemAniversario(nome: string) {
  return `Oi, ${nome.split(' ')[0]}! Aqui é a Camila 💛\n\nPassando pra desejar um feliz aniversário! 🎉 Espero que seu dia seja incrível. Um beijo!`
}

function mensagemSaudade(nome: string) {
  return `Oi, ${nome.split(' ')[0]}! Aqui é a Camila 💛\n\nFaz um tempo que a gente não se vê por aqui! Tô com saudade de cuidar de você — bora marcar um horário? 😊`
}

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    recebido_mes: 0,
    recebido_mes_anterior: 0,
    esperado_mes: 0,
    total_clientes: 0,
    novos_clientes_mes: 0,
    agendamentos_mes: 0,
    ticket_medio: 0,
    despesas_mes: 0,
    lucro_mes: 0,
  })
  const [proximosAgendamentos, setProximosAgendamentos] = useState<Agendamento[]>([])
  const [aniversariantes, setAniversariantes] = useState<Cliente[]>([])
  const [clientesSemRetorno, setClientesSemRetorno] = useState<Cliente[]>([])
  const [pagamentosAtrasados, setPagamentosAtrasados] = useState<Agendamento[]>([])
  const [chartData, setChartData] = useState<{ mes: string; faturamento: number }[]>([])

  async function loadDashboard() {
    setLoading(true)
    const hoje = new Date()
    const inicioMes = startOfMonth(hoje)
    const fimMes = endOfMonth(hoje)
    const inicioMesAnterior = startOfMonth(subMonths(hoje, 1))
    const fimMesAnterior = endOfMonth(subMonths(hoje, 1))

    const [
      { data: agendamentosMes },
      { data: agendamentosMesAnterior },
      { count: totalClientesCount },
      { count: novosClientesCount },
      { data: despesas },
      { data: proximos },
      { data: todosClientes },
      { data: lancamentosChart },
      { data: atrasados },
    ] = await Promise.all([
      supabase.from('agendamentos').select('valor_cobrado, status, status_pagamento, valor_pago').neq('status', 'cancelado')
        .gte('data_hora', inicioMes.toISOString()).lte('data_hora', fimMes.toISOString()),
      supabase.from('agendamentos').select('valor_cobrado, status, status_pagamento, valor_pago').eq('status', 'realizado')
        .gte('data_hora', inicioMesAnterior.toISOString()).lte('data_hora', fimMesAnterior.toISOString()),
      supabase.from('clientes').select('id', { count: 'exact', head: true }),
      supabase.from('clientes').select('id', { count: 'exact', head: true })
        .gte('created_at', inicioMes.toISOString()),
      supabase.from('lancamentos').select('valor').eq('tipo', 'saida')
        .gte('data', format(inicioMes, 'yyyy-MM-dd')).lte('data', format(fimMes, 'yyyy-MM-dd')),
      supabase.from('agendamentos').select('*, cliente:clientes(nome, telefone), servico:servicos(nome)')
        .gte('data_hora', hoje.toISOString()).in('status', ['agendado', 'confirmado'])
        .order('data_hora').limit(5),
      supabase.from('clientes').select('*, agendamentos(data_hora)').order('nome'),
      supabase.from('lancamentos').select('valor, data, tipo')
        .gte('data', format(startOfMonth(subMonths(hoje, 5)), 'yyyy-MM-dd'))
        .lte('data', format(fimMes, 'yyyy-MM-dd')),
      supabase.from('agendamentos').select('*, cliente:clientes(nome, telefone), servico:servicos(nome)')
        .neq('status_pagamento', 'pago').neq('status', 'cancelado')
        .not('data_prevista_pagamento', 'is', null)
        .lt('data_prevista_pagamento', format(hoje, 'yyyy-MM-dd'))
        .order('data_prevista_pagamento'),
    ])

    // Recebido = dinheiro que já entrou de verdade (pago inteiro, ou a parte já paga de um parcial).
    // Esperado = o que ainda falta entrar: agendamentos futuros (agendado/confirmado) + o saldo
    // de atendimentos já realizados mas ainda não totalmente pagos.
    function recebidoDe(ags: any[]) {
      return ags?.reduce((s, a) => {
        if (a.status !== 'realizado') return s
        if (a.status_pagamento === 'pago') return s + Number(a.valor_cobrado)
        if (a.status_pagamento === 'parcial') return s + Number(a.valor_pago ?? 0)
        return s
      }, 0) ?? 0
    }
    function esperadoDe(ags: any[]) {
      return ags?.reduce((s, a) => {
        if (a.status === 'agendado' || a.status === 'confirmado') return s + Number(a.valor_cobrado)
        if (a.status === 'realizado' && a.status_pagamento !== 'pago') {
          return s + (Number(a.valor_cobrado) - (a.status_pagamento === 'parcial' ? Number(a.valor_pago ?? 0) : 0))
        }
        return s
      }, 0) ?? 0
    }

    const recebido = recebidoDe(agendamentosMes ?? [])
    const recebidoAnterior = recebidoDe(agendamentosMesAnterior ?? [])
    const esperado = esperadoDe(agendamentosMes ?? [])
    const totalDespesas = despesas?.reduce((s, l) => s + Number(l.valor), 0) ?? 0
    const realizadosMes = (agendamentosMes ?? []).filter((a: any) => a.status === 'realizado')
    const valorRealizadosMes = realizadosMes.reduce((s, a) => s + Number(a.valor_cobrado), 0)

    setStats({
      recebido_mes: recebido,
      recebido_mes_anterior: recebidoAnterior,
      esperado_mes: esperado,
      total_clientes: totalClientesCount ?? 0,
      novos_clientes_mes: novosClientesCount ?? 0,
      agendamentos_mes: realizadosMes.length,
      ticket_medio: realizadosMes.length > 0 ? valorRealizadosMes / realizadosMes.length : 0,
      despesas_mes: totalDespesas,
      lucro_mes: recebido - totalDespesas,
    })

    setProximosAgendamentos((proximos as any) ?? [])
    setPagamentosAtrasados((atrasados as any) ?? [])

    const mesAtual = hoje.getMonth() + 1
    const aniversariantesMes = (todosClientes ?? []).filter((c: any) => {
      if (!c.data_nascimento) return false
      const mesNasc = new Date(c.data_nascimento + 'T00:00:00').getMonth() + 1
      return mesNasc === mesAtual
    })
    setAniversariantes(aniversariantesMes)

    const semRetorno = (todosClientes ?? []).filter((c: any) => {
      const agendamentos = c.agendamentos ?? []
      if (agendamentos.length === 0) return false
      const ultimo = agendamentos.sort((a: any, b: any) =>
        new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime()
      )[0]
      return differenceInDays(hoje, new Date(ultimo.data_hora)) > 60
    })
    setClientesSemRetorno(semRetorno.slice(0, 5))

    // Gráfico dos últimos 6 meses
    const mesesChart: { mes: string; faturamento: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const mesRef = subMonths(hoje, i)
      const inicio = format(startOfMonth(mesRef), 'yyyy-MM-dd')
      const fim = format(endOfMonth(mesRef), 'yyyy-MM-dd')
      const entradas = (lancamentosChart ?? []).filter(
        (l: any) => l.tipo === 'entrada' && l.data >= inicio && l.data <= fim
      )
      const agMes = entradas.reduce((s: number, l: any) => s + Number(l.valor), 0)
      mesesChart.push({
        mes: format(mesRef, 'MMM', { locale: ptBR }),
        faturamento: agMes,
      })
    }
    setChartData(mesesChart)

    setLoading(false)
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  async function confirmarAgendamento(id: string) {
    const { error } = await supabase.from('agendamentos').update({ status: 'confirmado' }).eq('id', id)
    if (error) { toast.error('Erro ao confirmar agendamento'); return }
    setProximosAgendamentos(ags => ags.map(a => a.id === id ? { ...a, status: 'confirmado' } : a))
    toast.success('Agendamento confirmado!')
  }

  const variacaoRecebido = stats.recebido_mes_anterior > 0
    ? ((stats.recebido_mes - stats.recebido_mes_anterior) / stats.recebido_mes_anterior * 100).toFixed(1)
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-brand-dark tracking-wide">Olá, Camila</h1>
        <p className="text-muted-foreground capitalize">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
      </div>

      {/* Central do dia — o que precisa de ação agora */}
      <Card className="border-brand-gold/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-4 w-4 text-brand-medium" />
            Próximos Atendimentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {proximosAgendamentos.length === 0 ? (
            <p className="text-sm text-brand-muted-soft text-center py-6">Nenhum agendamento próximo</p>
          ) : (
            <div className="space-y-2">
              {proximosAgendamentos.map((ag: any) => {
                const dt = new Date(ag.data_hora)
                const hojeAg = isToday(dt)
                return (
                  <div key={ag.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-border bg-brand-surface p-3">
                    <div className="flex shrink-0 flex-col items-center justify-center rounded-lg border border-brand-border bg-card px-3 py-1.5 text-center">
                      <span className="text-[10px] font-medium tracking-wide text-brand-muted">
                        {hojeAg ? 'HOJE' : format(dt, 'dd/MM')}
                      </span>
                      <span className="font-heading text-base font-semibold text-brand-dark">{format(dt, 'HH:mm')}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="truncate text-sm font-medium text-brand-dark">{ag.cliente?.nome}</p>
                        <Badge variant={STATUS_BADGE_VARIANT[ag.status as Agendamento['status']]} className="shrink-0">
                          {STATUS_LABELS[ag.status as Agendamento['status']]}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-brand-muted">{ag.servico?.nome}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {ag.status === 'agendado' && (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 gap-1 px-2 text-xs text-success"
                          onClick={() => confirmarAgendamento(ag.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar
                        </Button>
                      )}
                      {ag.cliente?.telefone && (
                        <Button
                          size="icon-sm" variant="outline" className="text-success"
                          title="Enviar confirmação no WhatsApp"
                          onClick={() => window.open(
                            linkWhatsApp(
                              ag.cliente.telefone,
                              mensagemConfirmacao(ag.cliente.nome, ag.servico?.nome ?? 'seu procedimento', dt, Number(ag.valor_cobrado), false)
                            ), '_blank')}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-brand-text-soft">Recebido no Mês</CardTitle>
            <DollarSign className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-brand-dark">{formatCurrency(stats.recebido_mes)}</p>
            {variacaoRecebido ? (
              <p className={`text-xs mt-1 flex items-center gap-1 ${Number(variacaoRecebido) >= 0 ? 'text-success' : 'text-danger'}`}>
                {Number(variacaoRecebido) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {variacaoRecebido}% vs mês anterior
              </p>
            ) : (
              <p className="text-xs mt-1 text-muted-foreground">Dinheiro já confirmado</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-brand-text-soft">A Receber</CardTitle>
            <DollarSign className="h-5 w-5 text-brand-gold" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-brand-dark">{formatCurrency(stats.esperado_mes)}</p>
            <p className="text-xs mt-1 text-muted-foreground">Agendado + saldo pendente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-brand-text-soft">Lucro do Mês</CardTitle>
            <TrendingUp className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-brand-dark">{formatCurrency(stats.lucro_mes)}</p>
            <p className="text-xs mt-1 text-muted-foreground">Despesas: {formatCurrency(stats.despesas_mes)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-brand-text-soft">Total de Clientes</CardTitle>
            <Users className="h-5 w-5 text-brand-medium" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-brand-dark">{stats.total_clientes}</p>
            <p className="text-xs mt-1 text-success">+{stats.novos_clientes_mes} novas este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-brand-text-soft">Ticket Médio</CardTitle>
            <Scissors className="h-5 w-5 text-brand-gold" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-brand-dark">{formatCurrency(stats.ticket_medio)}</p>
            <p className="text-xs mt-1 text-muted-foreground">{stats.agendamentos_mes} atendimentos no mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico e alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Entradas dos Últimos 6 Meses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="faturamento" fill="#C9A96E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-4 w-4 text-brand-muted" />
              Aniversariantes do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aniversariantes.length === 0 ? (
              <p className="text-sm text-brand-muted-soft text-center py-4">Nenhum aniversariante este mês</p>
            ) : (
              <div className="space-y-2">
                {aniversariantes.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-brand-surface">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-brand-dark truncate">{c.nome}</p>
                      <p className="text-xs text-brand-muted">{c.telefone}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-brand-medium font-medium">
                        {format(new Date(c.data_nascimento + 'T00:00:00'), 'dd/MM')}
                      </span>
                      {c.telefone && (
                        <Button
                          size="icon-sm" variant="outline" className="text-success"
                          title="Mandar parabéns no WhatsApp"
                          onClick={() => window.open(linkWhatsApp(c.telefone, mensagemAniversario(c.nome)), '_blank')}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-brand-terra" />
            Clientes sem Retorno (+60 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clientesSemRetorno.length === 0 ? (
            <p className="text-sm text-brand-muted-soft text-center py-4">Todas as clientes retornaram recentemente</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {clientesSemRetorno.map((c: any) => {
                const ultimoAg = c.agendamentos?.sort((a: any, b: any) =>
                  new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime()
                )[0]
                const diasSemRetorno = ultimoAg
                  ? differenceInDays(new Date(), new Date(ultimoAg.data_hora))
                  : null
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-brand-surface-warm">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-brand-dark truncate">{c.nome}</p>
                      <p className="text-xs text-brand-muted">{c.telefone}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {diasSemRetorno && (
                        <span className="text-xs text-brand-terra font-medium">{diasSemRetorno}d atrás</span>
                      )}
                      {c.telefone && (
                        <Button
                          size="icon-sm" variant="outline" className="text-success"
                          title="Mandar mensagem no WhatsApp"
                          onClick={() => window.open(linkWhatsApp(c.telefone, mensagemSaudade(c.nome)), '_blank')}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {pagamentosAtrasados.length > 0 && (
        <Card className="border-danger/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-danger" />
              Pagamentos em Atraso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pagamentosAtrasados.map((ag: any) => {
                const saldo = ag.status_pagamento === 'parcial'
                  ? Number(ag.valor_cobrado) - Number(ag.valor_pago ?? 0)
                  : Number(ag.valor_cobrado)
                const diasAtraso = differenceInDays(new Date(), new Date(ag.data_prevista_pagamento + 'T00:00:00'))
                return (
                  <div key={ag.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-danger-soft">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-brand-dark truncate">{ag.cliente?.nome}</p>
                      <p className="text-xs text-danger">{formatCurrency(saldo)} · {diasAtraso}d de atraso</p>
                    </div>
                    {ag.cliente?.telefone && (
                      <Button
                        size="icon-sm" variant="outline" className="shrink-0 text-danger"
                        title="Cobrar no WhatsApp"
                        onClick={() => window.open(
                          linkWhatsApp(ag.cliente.telefone, mensagemCobranca(ag.cliente.nome, ag.servico?.nome ?? 'procedimento', saldo)),
                          '_blank'
                        )}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
