'use client'

import { useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceDot } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { type Dados, type MetricaCurva, type Periodo, type PontoCurva, METRICAS_CURVA, montarCurva, rotuloDiaCurto } from './calculos'
import { COR, CaixaTooltip, ItemLegenda, Nota, Segmentado, TituloSecao, VerEmNumeros, formatar, formatarEixo, type LinhaTooltip } from './ui'

export function CurvaAcumulada({ dados, periodo }: { dados: Dados; periodo: Periodo }) {
  const [metrica, setMetrica] = useState<MetricaCurva>('faturamento')
  const def = METRICAS_CURVA.find(m => m.id === metrica)!
  const curva = montarCurva(dados, periodo, metrica)
  const dinheiro = !!def.dinheiro
  const f = (v: number) => formatar(v, dinheiro)

  const ultimoAtual = [...curva.pontos].reverse().find(p => p.atual !== null)
  const temProjecao = curva.projecaoFinal !== null
  const ehMes = !!periodo.mes

  const ticks = ehMes
    ? [1, 5, 10, 15, 20, 25, curva.pontos.length]
    : undefined

  const titulo = ehMes ? `Como ${periodo.mes!.nome} vem se formando` : 'Como o período vem se formando'

  return (
    <Card>
      <CardContent className="space-y-4">
        <TituloSecao
          titulo={titulo}
          sub="Soma dia a dia. Linha mais inclinada = mês andando mais rápido."
        />
        <Segmentado
          rotulo="Métrica do gráfico"
          opcoes={METRICAS_CURVA.map(m => ({ id: m.id, rotulo: m.rotulo }))}
          valor={metrica}
          onChange={setMetrica}
        />

        {/* Rótulo direto: os três números que o gráfico conta, escritos. */}
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          <div>
            <p className="text-[11px] text-brand-muted">{ehMes ? 'Até hoje' : curva.rotuloAtual}</p>
            <p className="text-2xl font-semibold leading-tight text-brand-dark">{f(curva.totalAtual)}</p>
          </div>
          {temProjecao && (
            <div>
              <p className="text-[11px] text-brand-muted">No fim do mês, no ritmo atual</p>
              <p className="text-lg font-semibold leading-tight text-brand-text-soft">≈ {f(curva.projecaoFinal!)}</p>
            </div>
          )}
          {curva.totalAnterior !== null && (
            <div>
              <p className="text-[11px] text-brand-muted">
                {ehMes ? `${curva.rotuloAnterior} no mesmo dia` : `${curva.rotuloAnterior}`}
              </p>
              <p className="text-lg font-semibold leading-tight text-brand-muted">{f(curva.totalAnterior)}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <ItemLegenda cor={COR.serie1} rotulo={curva.rotuloAtual} />
          {curva.temAnterior && curva.rotuloAnterior && <ItemLegenda cor={COR.contexto} rotulo={curva.rotuloAnterior} />}
          {temProjecao && <ItemLegenda cor={COR.serie1} rotulo="Projeção" tracejado />}
        </div>

        <div className="-mx-1 h-60 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={curva.pontos} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="lavagem-curva" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COR.serie1} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={COR.serie1} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={COR.grade} />
              <XAxis
                dataKey="x"
                type="number"
                domain={[1, Math.max(curva.pontos.length, 2)]}
                ticks={ticks}
                tickFormatter={(x: number) => ehMes ? String(x) : rotuloDiaCurto(curva.pontos[x - 1]?.dia ?? curva.pontos[0].dia)}
                tick={{ fontSize: 11, fill: COR.texto }}
                tickLine={false}
                axisLine={{ stroke: COR.eixo }}
                minTickGap={18}
              />
              <YAxis
                width={40}
                tickFormatter={(v: number) => formatarEixo(v)}
                tick={{ fontSize: 11, fill: COR.texto }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ stroke: COR.eixo, strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as PontoCurva
                  const linhas: LinhaTooltip[] = []
                  if (p.atual !== null) linhas.push({ cor: COR.serie1, rotulo: curva.rotuloAtual, valor: f(p.atual) })
                  if (p.projecao !== null && p.atual === null) linhas.push({ cor: COR.serie1, rotulo: 'Projeção', valor: `≈ ${f(p.projecao)}`, tracejado: true })
                  if (p.anterior !== null && curva.rotuloAnterior) {
                    linhas.push({ cor: COR.contexto, rotulo: ehMes ? curva.rotuloAnterior : `até ${rotuloDiaCurto(p.diaAnterior!)}`, valor: f(p.anterior) })
                  }
                  return <CaixaTooltip titulo={ehMes ? `Até o dia ${p.x}` : `Até ${rotuloDiaCurto(p.dia)}`} linhas={linhas} />
                }}
              />
              {curva.temAnterior && (
                <Line
                  dataKey="anterior"
                  stroke={COR.contexto}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: COR.contexto, stroke: '#FBF9F5', strokeWidth: 2 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              )}
              <Area
                dataKey="atual"
                stroke={COR.serie1}
                strokeWidth={2}
                fill="url(#lavagem-curva)"
                dot={false}
                activeDot={{ r: 4, fill: COR.serie1, stroke: '#FBF9F5', strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls={false}
              />
              {temProjecao && (
                <Line
                  dataKey="projecao"
                  stroke={COR.serie1}
                  strokeOpacity={0.7}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              )}
              {ultimoAtual && (
                <ReferenceDot x={ultimoAtual.x} y={ultimoAtual.atual!} r={4.5} fill={COR.serie1} stroke="#FBF9F5" strokeWidth={2} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {curva.avisoAnterior && <Nota>{curva.avisoAnterior}</Nota>}
        {metrica === 'faturamento' && (
          <Nota>
            Faturamento = valor cobrado dos atendimentos que já passaram e não foram cancelados — mesmo
            os que ficaram como “agendado” no sistema.
          </Nota>
        )}

        <VerEmNumeros>
          <TabelaCurva pontos={curva.pontos} f={f} ehMes={ehMes} rotuloAtual={curva.rotuloAtual} rotuloAnterior={curva.temAnterior ? curva.rotuloAnterior : null} />
        </VerEmNumeros>
      </CardContent>
    </Card>
  )
}

function TabelaCurva({ pontos, f, ehMes, rotuloAtual, rotuloAnterior }: {
  pontos: PontoCurva[]; f: (v: number) => string; ehMes: boolean; rotuloAtual: string; rotuloAnterior: string | null
}) {
  // Uma linha por semana do período (mais o último dia) — dia a dia viraria 30 linhas.
  const linhas = pontos.filter((p, i) => (i + 1) % 7 === 0 || i === pontos.length - 1 || (p.atual !== null && pontos[i + 1]?.atual === null))
  const unicas = linhas.filter((p, i) => linhas.findIndex(q => q.x === p.x) === i)
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-brand-border text-left text-brand-muted">
          <th className="py-1.5 pr-3 font-medium">{ehMes ? 'Até o dia' : 'Até'}</th>
          <th className="py-1.5 pr-3 text-right font-medium">{rotuloAtual}</th>
          {rotuloAnterior && <th className="py-1.5 text-right font-medium">{rotuloAnterior}</th>}
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {unicas.map(p => (
          <tr key={p.x} className="border-b border-brand-border/50 last:border-0">
            <td className="py-1.5 pr-3 text-brand-text-soft">{ehMes ? p.x : rotuloDiaCurto(p.dia)}</td>
            <td className="py-1.5 pr-3 text-right text-brand-dark">
              {p.atual !== null ? f(p.atual) : p.projecao !== null ? <span className="text-brand-muted">≈ {f(p.projecao)}</span> : '—'}
            </td>
            {rotuloAnterior && <td className="py-1.5 text-right text-brand-muted">{p.anterior !== null ? f(p.anterior) : '—'}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
