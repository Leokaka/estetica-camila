'use client'

import { useState } from 'react'
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Mes, Semana } from './calculos'
import { capitalizar } from './calculos'
import { COR, CaixaTooltip, ItemLegenda, Nota, Segmentado, TituloSecao, VerEmNumeros, brl, formatar, formatarEixo } from './ui'

type Medida = 'atendimentos' | 'faturamento'

export function SemanaASemana({ semanas, meses }: { semanas: Semana[]; meses: Mes[] }) {
  const [medida, setMedida] = useState<Medida>('faturamento')
  const dinheiro = medida === 'faturamento'
  const f = (v: number) => formatar(v, dinheiro)
  const chaveMedia = dinheiro ? 'mediaFaturamento' : 'mediaAtendimentos'

  // Resposta curta pra "estamos crescendo?": média das 4 últimas semanas fechadas
  // contra as 4 antes delas.
  const fechadas = semanas.filter(s => !s.emCurso)
  const ultimas = fechadas.slice(-4)
  const antes = fechadas.slice(-8, -4)
  const soma = (l: Semana[]) => l.reduce((s, x) => s + x[medida], 0)
  const tendencia = antes.length === 4 && soma(antes) > 0 ? Math.round(((soma(ultimas) - soma(antes)) / soma(antes)) * 100) : null

  return (
    <Card>
      <CardContent className="space-y-4">
        <TituloSecao
          icone={<TrendingUp className="h-4 w-4 text-brand-muted" />}
          titulo="Estamos crescendo?"
          sub="Últimas 12 semanas (segunda a domingo). Não muda com o período lá de cima."
        />
        <Segmentado
          rotulo="Medida das semanas"
          opcoes={[{ id: 'faturamento', rotulo: 'Faturamento' }, { id: 'atendimentos', rotulo: 'Atendimentos' }]}
          valor={medida}
          onChange={setMedida}
        />

        {tendencia !== null && (
          <p className="text-sm text-brand-text-soft">
            As últimas 4 semanas somaram{' '}
            <span className="font-semibold text-brand-dark">{f(soma(ultimas))}</span>,{' '}
            {Math.abs(tendencia) < 5
              ? 'quase o mesmo que as 4 anteriores.'
              : <><span className={cn('font-semibold', tendencia > 0 ? 'text-success' : 'text-danger')}>{tendencia > 0 ? '+' : ''}{tendencia}%</span> em relação às 4 anteriores ({f(soma(antes))}).</>}
          </p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <ItemLegenda cor={COR.serie1} rotulo={dinheiro ? 'Faturamento da semana' : 'Atendimentos da semana'} tipo="bloco" />
          <ItemLegenda cor={COR.serie2} rotulo="Média das últimas 4 semanas" />
        </div>

        <div className="-mx-1 h-56 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={semanas} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={COR.grade} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: COR.texto }} tickLine={false} axisLine={{ stroke: COR.eixo }} interval="preserveStartEnd" minTickGap={14} />
              <YAxis width={40} tickFormatter={(v: number) => formatarEixo(v)} tick={{ fontSize: 11, fill: COR.texto }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: COR.grade, fillOpacity: 0.5 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const s = payload[0].payload as Semana
                  const media = s[chaveMedia]
                  return (
                    <CaixaTooltip
                      titulo={`Semana de ${s.rotulo}${s.emCurso ? ' (em curso)' : ''}`}
                      linhas={[
                        { cor: COR.serie1, rotulo: dinheiro ? 'Faturamento' : 'Atendimentos', valor: f(s[medida]) },
                        ...(media !== null ? [{ cor: COR.serie2, rotulo: 'Média 4 sem.', valor: f(media) }] : []),
                      ]}
                    />
                  )
                }}
              />
              <Bar dataKey={medida} barSize={18} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {semanas.map(s => (
                  // Semana em curso mais clara: está pela metade, não caiu.
                  <Cell key={s.segunda} fill={COR.serie1} fillOpacity={s.emCurso ? 0.35 : 0.85} />
                ))}
              </Bar>
              <Line
                dataKey={chaveMedia}
                stroke={COR.serie2}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: COR.serie2, stroke: '#FBF9F5', strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <Nota>A barra mais clara é a semana em curso — ainda não terminou, por isso fica fora da média.</Nota>

        <VerEmNumeros>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-brand-border text-left text-brand-muted">
                <th className="py-1.5 pr-3 font-medium">Semana de</th>
                <th className="py-1.5 pr-3 text-right font-medium">Atend.</th>
                <th className="py-1.5 pr-3 text-right font-medium">Faturamento</th>
                <th className="py-1.5 text-right font-medium">Média 4 sem.</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {semanas.map(s => (
                <tr key={s.segunda} className="border-b border-brand-border/50 last:border-0">
                  <td className="py-1.5 pr-3 text-brand-text-soft">{s.rotulo}{s.emCurso && ' *'}</td>
                  <td className="py-1.5 pr-3 text-right text-brand-dark">{s.atendimentos}</td>
                  <td className="py-1.5 pr-3 text-right text-brand-dark">{brl.format(s.faturamento)}</td>
                  <td className="py-1.5 text-right text-brand-muted">{s[chaveMedia] !== null ? f(s[chaveMedia]!) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </VerEmNumeros>

        <div className="border-t border-brand-border pt-4">
          <h3 className="text-sm font-medium text-brand-dark">Mês a mês, desde o começo</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-brand-border text-left text-brand-muted">
                  <th className="py-1.5 pr-2 font-medium">Mês</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Faturamento</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Atend.</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Novas</th>
                  <th className="py-1.5 text-right font-medium">Ticket</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {meses.map(m => {
                  const maior = Math.max(1, ...meses.map(x => x.faturamento))
                  return (
                    <tr key={m.chave} className="border-b border-brand-border/50 last:border-0">
                      <td className="py-2 pr-2 text-brand-text-soft">
                        {capitalizar(m.rotulo)}
                        {m.emCurso && <span className="ml-1 text-[10px] text-brand-muted-soft">até hoje</span>}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <span className="font-medium text-brand-dark">{brl.format(m.faturamento)}</span>
                        <span className="mt-1 ml-auto block h-1 rounded-full bg-brand-surface" style={{ width: '100%' }}>
                          <span className="block h-1 rounded-full" style={{ width: `${(m.faturamento / maior) * 100}%`, background: COR.serie1, opacity: m.emCurso ? 0.45 : 0.85 }} />
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-right text-brand-dark">{m.atendimentos}</td>
                      <td className="py-2 pr-2 text-right text-brand-dark">{m.clientesNovas}</td>
                      <td className="py-2 text-right text-brand-muted">{m.atendimentos > 0 ? brl.format(m.ticket) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {meses.some(m => m.atendimentos === 0 && !m.emCurso) && (
            <Nota className="mt-2">Mês zerado é mês sem nenhum atendimento lançado no sistema.</Nota>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
