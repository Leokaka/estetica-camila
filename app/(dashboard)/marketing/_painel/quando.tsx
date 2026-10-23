'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { montarDiasDaSemana } from './calculos'
import { COR, CaixaTooltip, ItemLegenda, Nota, TituloSecao } from './ui'

type Linha = ReturnType<typeof montarDiasDaSemana>[number]

const NOME_LONGO: Record<string, string> = {
  Seg: 'segunda', Ter: 'terça', Qua: 'quarta', Qui: 'quinta', Sex: 'sexta', Sáb: 'sábado', Dom: 'domingo',
}

/** "na quarta", "no sábado". */
function naNo(dia: string) {
  return dia === 'sábado' || dia === 'domingo' ? `no ${dia}` : `na ${dia}`
}

function melhorDia(linhas: Linha[], campo: keyof Omit<Linha, 'rotulo'>) {
  const total = linhas.reduce((s, l) => s + l[campo], 0)
  if (total < 5) return null
  const topo = [...linhas].sort((a, b) => b[campo] - a[campo])[0]
  return NOME_LONGO[topo.rotulo]
}

const eixoX = { tick: { fontSize: 11, fill: COR.texto }, tickLine: false, axisLine: { stroke: COR.eixo } } as const
const eixoY = { width: 28, tick: { fontSize: 11, fill: COR.texto }, tickLine: false, axisLine: false, allowDecimals: false } as const

export function QuandoAcontece({ linhas }: { linhas: Linha[] }) {
  const diaVisita = melhorDia(linhas, 'visitas')
  const diaConversa = melhorDia(linhas, 'conversas')
  const diaAtendimento = melhorDia(linhas, 'atendimentos')

  return (
    <Card>
      <CardContent className="space-y-4">
        <TituloSecao
          icone={<CalendarDays className="h-4 w-4 text-brand-muted" />}
          titulo="Quando acontece"
          sub="Por dia da semana, com todo o histórico — pra escolher o dia de postar."
        />
        {(diaVisita || diaAtendimento) && (
          <p className="text-sm text-brand-text-soft">
            {diaVisita && <>Mais gente olha a página <span className="font-semibold text-brand-dark">{naNo(diaVisita)}</span>
              {diaConversa && diaConversa !== diaVisita && <> e chama no WhatsApp <span className="font-semibold text-brand-dark">{naNo(diaConversa)}</span></>}. </>}
            {diaAtendimento && <>O dia mais cheio de atendimento é <span className="font-semibold text-brand-dark">{diaAtendimento}</span>.</>}
          </p>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-brand-dark">Visitas e conversas</h3>
              <div className="flex gap-3">
                <ItemLegenda cor={COR.serie1} rotulo="Visitas" tipo="bloco" />
                <ItemLegenda cor={COR.serie2} rotulo="Conversas" tipo="bloco" />
              </div>
            </div>
            <div className="-mx-1 mt-2 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={linhas} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke={COR.grade} />
                  <XAxis dataKey="rotulo" {...eixoX} />
                  <YAxis {...eixoY} />
                  <Tooltip
                    cursor={{ fill: COR.grade, fillOpacity: 0.5 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const l = payload[0].payload as Linha
                      return <CaixaTooltip titulo={NOME_LONGO[l.rotulo]} linhas={[
                        { cor: COR.serie1, rotulo: 'Visitas', valor: String(l.visitas) },
                        { cor: COR.serie2, rotulo: 'Conversas', valor: String(l.conversas) },
                      ]} />
                    }}
                  />
                  <Bar dataKey="visitas" fill={COR.serie1} barSize={10} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="conversas" fill={COR.serie2} barSize={10} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Nota>Desde 22/09, quando a página começou a contar.</Nota>
          </div>

          <div>
            <h3 className="text-sm font-medium text-brand-dark">Atendimentos</h3>
            <div className="-mx-1 mt-2 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={linhas} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={COR.grade} />
                  <XAxis dataKey="rotulo" {...eixoX} />
                  <YAxis {...eixoY} />
                  <Tooltip
                    cursor={{ fill: COR.grade, fillOpacity: 0.5 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const l = payload[0].payload as Linha
                      return <CaixaTooltip titulo={NOME_LONGO[l.rotulo]} linhas={[{ cor: COR.serie1, rotulo: 'Atendimentos', valor: String(l.atendimentos) }]} />
                    }}
                  />
                  <Bar dataKey="atendimentos" fill={COR.serie1} barSize={18} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Nota>Todos os atendimentos feitos desde o começo do sistema.</Nota>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
