'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign, Users, Calendar, TrendingUp, TrendingDown,
  Gift, AlertCircle, Scissors
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { Agendamento, Cliente } from '@/types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    faturamento_mes: 0,
    faturamento_mes_anterior: 0,
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
  const [chartData, setChartData] = useState<{ mes: string; faturamento: number }[]>([])

  useEffect(() => {
    loadDashboard()
  }, [])

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
      { data: totalClientes },
      { data: novosClientes },
      { data: despesas },
      { data: proximos },
      { data: todosClientes },
      { data: lancamentosChart },
    ] = await Promise.all([
      supabase.from('agendamentos').select('valor_cobrado').eq('status', 'realizado')
        .gte('data_hora', inicioMes.toISOString()).lte('data_hora', fimMes.toISOString()),
      supabase.from('agendamentos').select('valor_cobrado').eq('status', 'realizado')
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
    ])

    const faturamento = agendamentosMes?.reduce((s, a) => s + Number(a.valor_cobrado), 0) ?? 0
    const faturamentoAnterior = agendamentosMesAnterior?.reduce((s, a) => s + Number(a.valor_cobrado), 0) ?? 0
    const totalDespesas = despesas?.reduce((s, l) => s + Number(l.valor), 0) ?? 0
    const qtdAgendamentos = agendamentosMes?.length ?? 0

    setStats({
      faturamento_mes: faturamento,
      faturamento_mes_anterior: faturamentoAnterior,
      total_clientes: (totalClientes as any)?.count ?? 0,
      novos_clientes_mes: (novosClientes as any)?.count ?? 0,
      agendamentos_mes: qtdAgendamentos,
      ticket_medio: qtdAgendamentos > 0 ? faturamento / qtdAgendamentos : 0,
      despesas_mes: totalDespesas,
      lucro_mes: faturamento - totalDespesas,
    })

    setProximosAgendamentos((proximos as any) ?? [])

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

  const variacaoFaturamento = stats.faturamento_mes_anterior > 0
    ? ((stats.faturamento_mes - stats.faturamento_mes_anterior) / stats.faturamento_mes_anterior * 100).toFixed(1)
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">{format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</p>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Faturamento do Mês</CardTitle>
            <DollarSign className="h-5 w-5 text-rose-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.faturamento_mes)}</p>
            {variacaoFaturamento && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${Number(variacaoFaturamento) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {Number(variacaoFaturamento) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {variacaoFaturamento}% vs mês anterior
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Lucro do Mês</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.lucro_mes)}</p>
            <p className="text-xs mt-1 text-gray-500">Despesas: {formatCurrency(stats.despesas_mes)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total de Clientes</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{stats.total_clientes}</p>
            <p className="text-xs mt-1 text-green-600">+{stats.novos_clientes_mes} novas este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Ticket Médio</CardTitle>
            <Scissors className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.ticket_medio)}</p>
            <p className="text-xs mt-1 text-gray-500">{stats.agendamentos_mes} atendimentos no mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico e próximos agendamentos */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Faturamento dos Últimos 6 Meses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="faturamento" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-rose-600" />
              Próximos Agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {proximosAgendamentos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum agendamento próximo</p>
            ) : (
              <div className="space-y-3">
                {proximosAgendamentos.map((ag: any) => (
                  <div key={ag.id} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{ag.cliente?.nome}</p>
                      <p className="text-xs text-gray-500 truncate">{ag.servico?.nome}</p>
                      <p className="text-xs text-rose-600 font-medium">
                        {format(new Date(ag.data_hora), "dd/MM 'às' HH:mm")}
                      </p>
                    </div>
                    <Badge variant={ag.status === 'confirmado' ? 'default' : 'outline'} className="text-xs shrink-0">
                      {ag.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-4 w-4 text-pink-500" />
              Aniversariantes do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aniversariantes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum aniversariante este mês</p>
            ) : (
              <div className="space-y-2">
                {aniversariantes.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-pink-50">
                    <div>
                      <p className="text-sm font-medium">{c.nome}</p>
                      <p className="text-xs text-gray-500">{c.telefone}</p>
                    </div>
                    <span className="text-xs text-pink-600 font-medium">
                      {format(new Date(c.data_nascimento + 'T00:00:00'), 'dd/MM')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Clientes sem Retorno (+60 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clientesSemRetorno.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Todas as clientes retornaram recentemente</p>
            ) : (
              <div className="space-y-2">
                {clientesSemRetorno.map((c: any) => {
                  const ultimoAg = c.agendamentos?.sort((a: any, b: any) =>
                    new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime()
                  )[0]
                  const diasSemRetorno = ultimoAg
                    ? differenceInDays(new Date(), new Date(ultimoAg.data_hora))
                    : null
                  return (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-50">
                      <div>
                        <p className="text-sm font-medium">{c.nome}</p>
                        <p className="text-xs text-gray-500">{c.telefone}</p>
                      </div>
                      {diasSemRetorno && (
                        <span className="text-xs text-amber-600 font-medium">{diasSemRetorno}d atrás</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
