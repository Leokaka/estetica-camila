'use client'

import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus, Eye, MessageCircle, UserPlus, CalendarCheck, Wallet, Receipt } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { type Metricas, type Periodo, projetarMes, variacao, medicaoCobre } from './calculos'
import { brl, formatar } from './ui'

type Comparacao =
  | { tipo: 'numero'; anterior: number; dinheiro?: boolean }
  | { tipo: 'aviso'; texto: string }
  | null

function Variacao({ atual, comparacao, rotulo }: { atual: number; comparacao: Comparacao; rotulo: string | null }) {
  if (!comparacao || !rotulo) return null
  if (comparacao.tipo === 'aviso') {
    return <p className="mt-2 text-[11px] leading-snug text-brand-muted-soft">{comparacao.texto}</p>
  }
  const v = variacao(atual, comparacao.anterior)
  const antes = formatar(comparacao.anterior, comparacao.dinheiro)
  if (v === null) {
    return (
      <p className="mt-2 text-[11px] leading-snug text-brand-muted-soft">
        {atual > 0 ? 'nada no período de comparação' : 'sem movimento nos dois períodos'}
      </p>
    )
  }
  const Icone = v > 0 ? ArrowUpRight : v < 0 ? ArrowDownRight : Minus
  return (
    <div className="mt-2 text-[11px] leading-snug">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums',
          v > 0 ? 'bg-success-soft text-success' : v < 0 ? 'bg-danger-soft text-danger' : 'bg-brand-surface text-brand-muted',
        )}
      >
        <Icone className="h-3 w-3" aria-hidden />
        {v > 0 ? '+' : ''}{v}%
      </span>
      <span className="ml-1 text-brand-muted">{rotulo}: {antes}</span>
    </div>
  )
}

function Cartao({
  icone, rotulo, valor, sub, comparacao, valorAtual, rotuloComparacao, projecao, extra, destaque,
}: {
  icone: ReactNode
  rotulo: string
  valor: string
  sub?: ReactNode
  comparacao: Comparacao
  valorAtual: number
  rotuloComparacao: string | null
  projecao?: string | null
  extra?: ReactNode
  destaque?: boolean
}) {
  return (
    <Card size="sm" className={cn('gap-0', destaque && 'border-brand-gold/50')}>
      <CardContent className="flex h-full flex-col">
        <p className="flex items-center gap-1.5 text-xs font-medium text-brand-text-soft">
          <span className="text-brand-muted" aria-hidden>{icone}</span>
          {rotulo}
        </p>
        <p className="mt-1.5 text-2xl font-semibold leading-none text-brand-dark sm:text-[1.7rem]">{valor}</p>
        {sub && <p className="mt-1 text-[11px] text-brand-muted">{sub}</p>}
        <Variacao atual={valorAtual} comparacao={comparacao} rotulo={rotuloComparacao} />
        {(projecao || extra) && (
          <div className="mt-auto space-y-0.5 pt-2.5">
            {projecao && (
              <p className="border-t border-dashed border-brand-border pt-2 text-[11px] leading-snug text-brand-text-soft">
                <span className="font-semibold text-brand-dark">≈ {projecao}</span> no fim do mês
                <span className="block text-brand-muted-soft">no ritmo atual</span>
              </p>
            )}
            {extra && <p className="text-[11px] leading-snug text-brand-muted">{extra}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function CartoesPrincipais({
  periodo, m, mAnt, agendaAFrente,
}: {
  periodo: Periodo
  m: Metricas
  mAnt: Metricas | null
  agendaAFrente: { qtd: number; valor: number } | null
}) {
  const rotulo = periodo.mes ? `vs. ${periodo.mes.nomeAnterior.slice(0, 3)}` : periodo.anterior ? `vs. ${periodo.dias} dias antes` : null

  // Visitas e conversas só se comparam com período que a medição cobriu inteiro.
  const siteComparavel = !!periodo.anterior && medicaoCobre(periodo.anterior)
  const compSite = (anterior: number): Comparacao => !mAnt
    ? null
    : siteComparavel
      ? { tipo: 'numero', anterior }
      : { tipo: 'aviso', texto: 'sem comparação: a medição do site começou em 22/09' }
  const comp = (anterior: number, dinheiro?: boolean): Comparacao => mAnt ? { tipo: 'numero', anterior, dinheiro } : null

  const proj = (valor: number, dinheiro?: boolean) => {
    const p = projetarMes(valor, periodo)
    return p === null ? null : formatar(p, dinheiro)
  }

  const visitasDesde = !medicaoCobre(periodo.atual) ? 'desde 22/09 · ' : ''

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Cartao
        icone={<Eye className="h-3.5 w-3.5" />}
        rotulo="Visitas na página"
        valor={formatar(m.visitas)}
        sub={<>{visitasDesde}{m.pessoas} {m.pessoas === 1 ? 'pessoa diferente' : 'pessoas diferentes'}</>}
        valorAtual={m.visitas}
        comparacao={compSite(mAnt?.visitas ?? 0)}
        rotuloComparacao={rotulo}
        projecao={proj(m.visitas)}
      />
      <Cartao
        icone={<MessageCircle className="h-3.5 w-3.5" />}
        rotulo="Conversas no WhatsApp"
        valor={formatar(m.conversas)}
        sub={m.visitas > 0 ? `${Math.round((m.conversas / m.visitas) * 100)} a cada 100 visitas` : visitasDesde ? 'desde 22/09' : undefined}
        valorAtual={m.conversas}
        comparacao={compSite(mAnt?.conversas ?? 0)}
        rotuloComparacao={rotulo}
        projecao={proj(m.conversas)}
        destaque
      />
      <Cartao
        icone={<UserPlus className="h-3.5 w-3.5" />}
        rotulo="Clientes novas"
        valor={formatar(m.clientesNovas)}
        sub="primeiro cadastro ou horário"
        valorAtual={m.clientesNovas}
        comparacao={comp(mAnt?.clientesNovas ?? 0)}
        rotuloComparacao={rotulo}
        projecao={proj(m.clientesNovas)}
      />
      <Cartao
        icone={<CalendarCheck className="h-3.5 w-3.5" />}
        rotulo="Atendimentos feitos"
        valor={formatar(m.atendimentos)}
        valorAtual={m.atendimentos}
        comparacao={comp(mAnt?.atendimentos ?? 0)}
        rotuloComparacao={rotulo}
        projecao={proj(m.atendimentos)}
        extra={agendaAFrente && agendaAFrente.qtd > 0
          ? <>+ {agendaAFrente.qtd} já {agendaAFrente.qtd === 1 ? 'marcado' : 'marcados'} até o fim do mês</>
          : null}
      />
      <Cartao
        icone={<Wallet className="h-3.5 w-3.5" />}
        rotulo="Faturamento"
        valor={brl.format(m.faturamento)}
        valorAtual={m.faturamento}
        comparacao={comp(mAnt?.faturamento ?? 0, true)}
        rotuloComparacao={rotulo}
        projecao={proj(m.faturamento, true)}
        extra={agendaAFrente && agendaAFrente.valor > 0
          ? <>+ {brl.format(agendaAFrente.valor)} na agenda até o fim do mês</>
          : null}
        destaque
      />
      <Cartao
        icone={<Receipt className="h-3.5 w-3.5" />}
        rotulo="Ticket médio"
        valor={m.atendimentos > 0 ? brl.format(m.ticket) : '—'}
        sub="por atendimento"
        valorAtual={m.ticket}
        comparacao={mAnt && mAnt.atendimentos > 0 && m.atendimentos > 0 ? { tipo: 'numero', anterior: mAnt.ticket, dinheiro: true } : null}
        rotuloComparacao={rotulo}
      />
    </div>
  )
}
