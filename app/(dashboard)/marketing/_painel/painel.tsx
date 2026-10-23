'use client'

import { useMemo, useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { clientesNaHoraDeVoltar, janelasPorServico, type ClienteParaRetorno } from '@/lib/retorno'
import {
  type AgendamentoBruto, type ClienteBruto, type EventoBruto, type PeriodoId, type ServicoBruto,
  PERIODOS, agendaAFrenteNoMes, calcularMetricas, medicaoCobre, montarClientes, montarDiasDaSemana,
  montarFunil, montarMeses, montarOrigens, montarPeriodo, montarResumo, montarSemanas, montarServicos, preparar,
} from './calculos'
import { CartoesPrincipais } from './cartoes'
import { CurvaAcumulada } from './curva'
import { FunilDoPeriodo } from './funil'
import { SemanaASemana } from './semanas'
import { OQueMaisSai } from './servicos'
import { SecaoClientes } from './clientes'
import { QuandoAcontece } from './quando'
import { DeOndeVem } from './origens'
import { ComoLer } from './como-ler'
import { Segmentado } from './ui'

export type Brutos = {
  eventos: EventoBruto[]
  agendamentos: AgendamentoBruto[]
  clientes: ClienteBruto[]
  servicos: ServicoBruto[]
}

/** Barra de período fixa no topo enquanto rola: tudo abaixo responde a ela. */
export function BarraPeriodo({ valor, onChange, comparacao }: { valor: PeriodoId; onChange: (p: PeriodoId) => void; comparacao?: string | null }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 bg-background/90 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
      <Segmentado
        rotulo="Período"
        opcoes={PERIODOS.map(p => ({ id: p.id, rotulo: p.rotulo }))}
        valor={valor}
        onChange={onChange}
        compacto
        className="grid w-full grid-cols-6 sm:inline-flex sm:w-auto"
      />
      {comparacao && (
        <p className="mt-1.5 text-[11px] text-brand-muted">
          Comparando {comparacao.replace(/^vs\. /, 'com ')}
        </p>
      )}
    </div>
  )
}

export function Painel({ brutos, agora }: { brutos: Brutos; agora: Date }) {
  const [periodoId, setPeriodoId] = useState<PeriodoId>('mes')

  const dados = useMemo(() => preparar(brutos, agora), [brutos, agora])

  const naHoraDeVoltar = useMemo(() => {
    const porCliente = new Map<string, NonNullable<ClienteParaRetorno['agendamentos']>>()
    for (const a of brutos.agendamentos) {
      const lista = porCliente.get(a.cliente_id) ?? []
      lista.push({ data_hora: a.data_hora, status: a.status, servico_id: a.servico_id })
      porCliente.set(a.cliente_id, lista)
    }
    const clientes: ClienteParaRetorno[] = brutos.clientes.map(c => ({
      id: c.id, nome: c.nome, telefone: c.telefone, contato_retorno_em: c.contato_retorno_em, agendamentos: porCliente.get(c.id) ?? [],
    }))
    return clientesNaHoraDeVoltar(clientes, janelasPorServico(brutos.servicos), agora).length
  }, [brutos, agora])

  const painel = useMemo(() => {
    const periodo = montarPeriodo(periodoId, dados)
    const m = calcularMetricas(dados, periodo.atual)
    const mAnt = periodo.anterior ? calcularMetricas(dados, periodo.anterior) : null
    const origens = montarOrigens(dados, periodo.atual)
    const servicos = montarServicos(dados, periodo.atual)
    return {
      periodo,
      m,
      mAnt,
      origens,
      servicos,
      resumo: montarResumo(periodo, m, mAnt, origens, servicos),
      agendaAFrente: agendaAFrenteNoMes(dados, periodo),
      funil: montarFunil(dados, periodo),
      clientes: montarClientes(dados, periodo.atual),
    }
  }, [dados, periodoId])

  // Estes não dependem do período: são sempre o histórico.
  const fixos = useMemo(() => ({
    semanas: montarSemanas(dados),
    meses: montarMeses(dados),
    diasDaSemana: montarDiasDaSemana(dados),
  }), [dados])

  if (dados.atendimentos.length === 0 && dados.eventos.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-brand-muted">
          Ainda não há atendimentos nem visitas registradas. Assim que a agenda e a página de
          agendamento tiverem movimento, os números aparecem aqui.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <BarraPeriodo valor={periodoId} onChange={setPeriodoId} comparacao={painel.periodo.rotuloComparacao} />

      {painel.resumo.length > 0 && (
        <Card className="border-brand-gold/40 bg-brand-surface-warm">
          <CardContent>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-brand-muted">
              <Lightbulb className="h-3.5 w-3.5" /> Em resumo
            </p>
            <ul className="mt-2 space-y-1.5">
              {painel.resumo.map(frase => (
                <li key={frase} className="flex gap-2 text-sm leading-relaxed text-brand-dark">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" />
                  {frase}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <CartoesPrincipais periodo={painel.periodo} m={painel.m} mAnt={painel.mAnt} agendaAFrente={painel.agendaAFrente} />
      <p className="-mt-2 text-[11px] leading-relaxed text-brand-muted">
        “Atendimento feito” = horário que já passou e não foi cancelado, mesmo que tenha ficado como
        “agendado”. {painel.periodo.mes && 'Os horários daqui pra frente aparecem como “já marcados”.'}
      </p>

      <CurvaAcumulada dados={dados} periodo={painel.periodo} />
      <FunilDoPeriodo funil={painel.funil} />
      <SemanaASemana semanas={fixos.semanas} meses={fixos.meses} />
      <OQueMaisSai servicos={painel.servicos} />
      <SecaoClientes clientes={painel.clientes} naHoraDeVoltar={naHoraDeVoltar} />
      <QuandoAcontece linhas={fixos.diasDaSemana} />
      <DeOndeVem origens={painel.origens} m={painel.m} medicaoParcial={!medicaoCobre(painel.periodo.atual)} />
      <ComoLer />
    </>
  )
}
