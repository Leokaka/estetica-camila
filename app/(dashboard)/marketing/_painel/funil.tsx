'use client'

import { Fragment } from 'react'
import { Filter } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { Funil } from './calculos'
import { rotuloDiaCurto } from './calculos'
import { COR, Nota, TituloSecao, brl, formatar } from './ui'

export function FunilDoPeriodo({ funil }: { funil: Funil }) {
  const etapas = [
    { rotulo: 'Visitas na página', valor: funil.visitas },
    { rotulo: 'Pessoas diferentes', valor: funil.pessoas },
    { rotulo: 'Clicaram no WhatsApp', valor: funil.clicaram },
    { rotulo: 'Clientes novas', valor: funil.clientesNovas },
    { rotulo: 'Fizeram o 1º atendimento', valor: funil.primeiroFeito },
  ]
  const maior = Math.max(1, ...etapas.map(e => e.valor))
  const vazio = etapas.every(e => e.valor === 0)

  return (
    <Card>
      <CardContent className="space-y-4">
        <TituloSecao
          icone={<Filter className="h-4 w-4 text-brand-muted" />}
          titulo="Do clique à cliente"
          sub={funil.cortado
            ? `Desde ${rotuloDiaCurto(funil.iniDia)}, quando a página começou a contar visitas.`
            : 'Quantas passam de uma etapa pra próxima, no período.'}
        />

        {vazio ? (
          <p className="rounded-lg bg-brand-surface px-3 py-4 text-center text-sm text-brand-muted">
            Nenhuma visita nem cliente nova neste período ainda.
          </p>
        ) : (
          <ol className="space-y-1">
            {etapas.map((e, i) => {
              const anterior = i > 0 ? etapas[i - 1].valor : null
              const passagem = anterior ? e.valor / anterior : null
              return (
                <Fragment key={e.rotulo}>
                  {i > 0 && (
                    <li aria-hidden className="flex items-center gap-2 pl-1 text-[11px] text-brand-muted">
                      <span className="h-3 w-px bg-brand-border" />
                      {passagem === null
                        ? '—'
                        : passagem > 1
                          ? 'mais que a etapa de cima'
                          : `${Math.round(passagem * 100)}% seguiram`}
                    </li>
                  )}
                  <li>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-brand-text-soft">{e.rotulo}</span>
                      <span className="font-semibold tabular-nums text-brand-dark">{formatar(e.valor)}</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-brand-surface">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${Math.max(e.valor > 0 ? 2 : 0, (e.valor / maior) * 100)}%`, background: COR.serie1, opacity: 1 - i * 0.12 }}
                      />
                    </div>
                  </li>
                </Fragment>
              )
            })}
            <li className="!mt-3 flex items-baseline justify-between gap-3 rounded-lg bg-brand-surface-warm px-3 py-2 text-sm">
              <span className="text-brand-text-soft">Faturamento dessas clientes novas</span>
              <span className="font-semibold tabular-nums text-brand-dark">{brl.format(funil.faturamentoNovas)}</span>
            </li>
          </ol>
        )}

        {funil.antes && (funil.antes.clientesNovas > 0 || funil.antes.faturamentoNovas > 0) && (
          <div className="rounded-lg border border-dashed border-brand-border px-3 py-2 text-xs text-brand-text-soft">
            <p className="font-medium text-brand-dark">Antes da medição ({rotuloDiaCurto(funil.antes.iniDia)} a 21/09)</p>
            <p className="mt-0.5">
              {funil.antes.clientesNovas} clientes novas · {funil.antes.primeiroFeito} fizeram o 1º atendimento ·{' '}
              {brl.format(funil.antes.faturamentoNovas)} faturados com elas
            </p>
          </div>
        )}

        <Nota>
          A ligação clique → cliente é pelo período, não pela pessoa: o sistema não sabe se quem clicou
          é a mesma que virou cliente. Por isso a conta é aproximada — e “mais que a etapa de cima” quer
          dizer que chegou cliente por outro caminho (indicação, passou na frente). O faturamento conta
          tudo que essas clientes já pagaram até hoje, inclusive quando voltaram.
        </Nota>
      </CardContent>
    </Card>
  )
}
