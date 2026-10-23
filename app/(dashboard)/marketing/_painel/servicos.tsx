'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { montarServicos } from './calculos'
import { COR, Nota, Segmentado, TituloSecao, brl, pct } from './ui'

type Ordem = 'faturamento' | 'qtd'
const LIMITE = 8

export function OQueMaisSai({ servicos }: { servicos: ReturnType<typeof montarServicos> }) {
  const [ordem, setOrdem] = useState<Ordem>('faturamento')
  const [todos, setTodos] = useState(false)

  const lista = [...servicos.servicos].sort((a, b) => b[ordem] - a[ordem] || b.faturamento - a.faturamento)
  const visiveis = todos ? lista : lista.slice(0, LIMITE)
  const maior = Math.max(1, ...lista.map(l => l[ordem]))
  const categorias = [...servicos.categorias].sort((a, b) => b.faturamento - a.faturamento)

  return (
    <Card>
      <CardContent className="space-y-4">
        <TituloSecao
          icone={<Sparkles className="h-4 w-4 text-brand-muted" />}
          titulo="O que mais sai"
          sub="Atendimentos feitos no período."
        />

        {lista.length === 0 ? (
          <p className="rounded-lg bg-brand-surface px-3 py-4 text-center text-sm text-brand-muted">
            Nenhum atendimento feito neste período ainda.
          </p>
        ) : (
          <>
            <Segmentado
              rotulo="Ordenar serviços por"
              opcoes={[{ id: 'faturamento', rotulo: 'Por faturamento' }, { id: 'qtd', rotulo: 'Por quantidade' }]}
              valor={ordem}
              onChange={setOrdem}
            />

            <ul className="space-y-3">
              {visiveis.map(s => (
                <li key={s.nome}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm text-brand-dark">{s.nome}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-dark">
                      {ordem === 'faturamento' ? brl.format(s.faturamento) : `${s.qtd}×`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-brand-surface">
                    <div className="h-1.5 rounded-full" style={{ width: `${(s[ordem] / maior) * 100}%`, background: COR.serie1 }} />
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-brand-muted">
                    <span>{ordem === 'faturamento' ? `${s.qtd}×` : brl.format(s.faturamento)}</span>
                    <span>ticket {brl.format(s.ticket)}</span>
                    <span>margem est. {brl.format(s.margem)}</span>
                  </p>
                </li>
              ))}
            </ul>
            {lista.length > LIMITE && (
              <button type="button" onClick={() => setTodos(v => !v)} className="text-xs font-medium text-primary hover:underline">
                {todos ? 'Mostrar menos' : `Ver todos os ${lista.length} serviços`}
              </button>
            )}

            <div className="grid gap-4 border-t border-brand-border pt-4 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-brand-dark">Por categoria</h3>
                <ul className="mt-2 space-y-2">
                  {categorias.map(c => {
                    const parte = servicos.faturamentoTotal > 0 ? c.faturamento / servicos.faturamentoTotal : 0
                    return (
                      <li key={c.nome}>
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="text-brand-text-soft">{c.nome}</span>
                          <span className="tabular-nums text-brand-dark">
                            <span className="font-semibold">{pct(parte)}</span>
                            <span className="ml-1.5 text-brand-muted">{brl.format(c.faturamento)} · {c.qtd}×</span>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-brand-surface">
                          <div className="h-1.5 rounded-full" style={{ width: `${parte * 100}%`, background: COR.serie2 }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <div className="rounded-xl bg-brand-surface p-3">
                <p className="text-xs text-brand-text-soft">Margem estimada do período</p>
                <p className="mt-1 text-2xl font-semibold text-brand-dark">{brl.format(servicos.margemTotal)}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-brand-muted">
                  Preço de tabela menos o custo de material cadastrado em Serviços, vezes os atendimentos.
                  É estimativa: não desconta desconto dado na hora, aluguel, taxa de cartão nem o tempo dela.
                </p>
              </div>
            </div>
          </>
        )}
        {servicos.semCusto > 0 && (
          <Nota>{servicos.semCusto} atendimento(s) de serviço sem custo cadastrado — a margem deles está cheia.</Nota>
        )}
      </CardContent>
    </Card>
  )
}
