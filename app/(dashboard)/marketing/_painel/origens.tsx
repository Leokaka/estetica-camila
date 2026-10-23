'use client'

import { MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ORIGENS } from '@/lib/origem'
import { type Metricas, type montarOrigens, nomeOrigem } from './calculos'
import { Nota, TituloSecao, brl, pct } from './ui'

const CHAVES_COMO_CONHECEU = new Set<string>(ORIGENS.map(o => o.valor))

export function DeOndeVem({ origens, m, medicaoParcial }: { origens: ReturnType<typeof montarOrigens>; m: Metricas; medicaoParcial: boolean }) {
  const semOrigemPreenchida = origens.clientesComOrigem === 0
  const fatOrigem = (chave: string) => {
    if (semOrigemPreenchida || !CHAVES_COMO_CONHECEU.has(chave)) return null
    return origens.faturamentoPorComoConheceu.get(chave) ?? 0
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <TituloSecao
          icone={<MapPin className="h-4 w-4 text-brand-muted" />}
          titulo="De onde vem quem chega"
          sub={medicaoParcial ? 'Visitas e conversas contam desde 22/09.' : 'Pelo link que a pessoa usou pra chegar na página.'}
        />

        {origens.linhas.length === 0 ? (
          <p className="rounded-lg bg-brand-surface px-3 py-4 text-center text-sm text-brand-muted">
            Nenhuma visita registrada neste período.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[20rem] text-xs">
              <thead>
                <tr className="border-b border-brand-border text-left text-brand-muted">
                  <th className="py-2 pr-2 font-medium">Origem</th>
                  <th className="py-2 pr-2 text-right font-medium">Visitas</th>
                  <th className="py-2 pr-2 text-right font-medium">Conversas</th>
                  <th className="py-2 pr-2 text-right font-medium">Taxa</th>
                  <th className="py-2 text-right font-medium">Faturou*</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {origens.linhas.map(o => {
                  const fat = fatOrigem(o.chave)
                  return (
                    <tr key={o.chave} className="border-b border-brand-border/50 last:border-0">
                      <td className="py-2.5 pr-2 text-sm text-brand-dark">{nomeOrigem(o.chave)}</td>
                      <td className="py-2.5 pr-2 text-right text-brand-text-soft">{o.visitas}</td>
                      <td className="py-2.5 pr-2 text-right font-medium text-brand-dark">{o.conversas}</td>
                      <td className="py-2.5 pr-2 text-right text-brand-text-soft">{o.visitas > 0 ? pct(o.taxa) : '—'}</td>
                      <td className="py-2.5 text-right text-brand-text-soft">{fat === null ? '—' : brl.format(fat)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {(m.instagram > 0 || m.maps > 0) && (
          <p className="text-xs text-brand-text-soft">
            Outros cliques na página: <span className="font-medium text-brand-dark">{m.instagram}</span> no Instagram ·{' '}
            <span className="font-medium text-brand-dark">{m.maps}</span> em “como chegar”.
          </p>
        )}

        <div className="rounded-xl bg-brand-surface p-3">
          <h3 className="text-sm font-medium text-brand-dark">Faturamento pelo “Como conheceu?”</h3>
          {semOrigemPreenchida ? (
            <p className="mt-1 text-xs leading-relaxed text-brand-text-soft">
              Ainda vazio: nenhuma cliente tem “Como conheceu?” preenchido. Começa a encher conforme as
              clientes novas tiverem essa resposta no cadastro — e dá pra preencher nas antigas também
              (Clientes → editar); aí o histórico delas entra aqui na hora.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-xs">
              {[...ORIGENS.map(o => ({ chave: o.valor as string, rotulo: o.label as string })), { chave: '__nao_informado', rotulo: 'Não informado' }]
                .map(o => ({ ...o, valor: origens.faturamentoPorComoConheceu.get(o.chave) ?? 0 }))
                .sort((a, b) => b.valor - a.valor)
                .map(o => (
                  <li key={o.chave} className="flex items-baseline justify-between gap-3">
                    <span className={o.chave === '__nao_informado' ? 'text-brand-muted' : 'text-brand-text-soft'}>{o.rotulo}</span>
                    <span className="font-medium tabular-nums text-brand-dark">{brl.format(o.valor)}</span>
                  </li>
                ))}
              <li className="pt-1 text-[11px] text-brand-muted">
                {origens.clientesComOrigem} de {origens.totalClientes} clientes com a resposta preenchida.
              </li>
            </ul>
          )}
        </div>

        <Nota>
          * Faturamento no período das clientes que responderam essa origem no “Como conheceu?” do
          cadastro (só Instagram e Google existem nos dois lugares). Anúncios, panfleto e cartão aparecem
          nas visitas, mas não têm resposta equivalente no cadastro.
        </Nota>
      </CardContent>
    </Card>
  )
}
