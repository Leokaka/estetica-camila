'use client'

import Link from 'next/link'
import { ArrowRight, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { montarClientes } from './calculos'
import { COR, ItemLegenda, Nota, TituloSecao, brl, pct } from './ui'

export function SecaoClientes({ clientes, naHoraDeVoltar }: { clientes: ReturnType<typeof montarClientes>; naHoraDeVoltar: number }) {
  const { primeira, voltaram } = clientes
  const totalFat = primeira.faturamento + voltaram.faturamento
  const parteVoltaram = totalFat > 0 ? voltaram.faturamento / totalFat : 0

  return (
    <Card>
      <CardContent className="space-y-4">
        <TituloSecao
          icone={<Users className="h-4 w-4 text-brand-muted" />}
          titulo="Clientes"
          sub="Quem veio pela primeira vez e quem voltou, nos atendimentos do período."
        />

        {totalFat === 0 && primeira.atendimentos + voltaram.atendimentos === 0 ? (
          <p className="rounded-lg bg-brand-surface px-3 py-4 text-center text-sm text-brand-muted">
            Nenhum atendimento feito neste período ainda.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { rotulo: 'Primeira vez', g: primeira, cor: COR.serie2 },
                { rotulo: 'Voltaram', g: voltaram, cor: COR.serie1 },
              ].map(({ rotulo, g, cor }) => (
                <div key={rotulo} className="rounded-xl bg-brand-surface p-3">
                  <ItemLegenda cor={cor} rotulo={rotulo} tipo="bloco" />
                  <p className="mt-1.5 text-xl font-semibold text-brand-dark">{brl.format(g.faturamento)}</p>
                  <p className="text-[11px] text-brand-muted">
                    {g.atendimentos} {g.atendimentos === 1 ? 'atendimento' : 'atendimentos'} · {g.clientes} {g.clientes === 1 ? 'cliente' : 'clientes'}
                  </p>
                </div>
              ))}
            </div>
            {totalFat > 0 && (
              <div>
                {/* Barra de parte-do-todo: dois blocos com 2px de respiro entre eles. */}
                <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`${pct(parteVoltaram)} do faturamento veio de quem voltou`}>
                  {primeira.faturamento > 0 && <div style={{ width: `${(1 - parteVoltaram) * 100}%`, background: COR.serie2 }} />}
                  {voltaram.faturamento > 0 && <div style={{ width: `${parteVoltaram * 100}%`, background: COR.serie1 }} />}
                </div>
                <p className="mt-1.5 text-xs text-brand-text-soft">
                  <span className="font-semibold text-brand-dark">{pct(parteVoltaram)}</span> do faturamento veio de quem já era cliente.
                </p>
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-1 gap-3 border-t border-brand-border pt-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-brand-text-soft">Taxa de retorno (desde o início)</p>
            <p className="mt-1 text-2xl font-semibold text-brand-dark">{pct(clientes.taxaRetorno)}</p>
            <p className="text-[11px] text-brand-muted">
              {clientes.comDoisOuMais} de {clientes.comAtendimento} clientes atendidas vieram 2 vezes ou mais
            </p>
          </div>
          <Link
            href="/dashboard#na-hora-de-voltar"
            className="group flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface-warm p-3 transition-colors hover:border-brand-gold"
          >
            <div>
              <p className="text-xs text-brand-text-soft">Na hora de voltar</p>
              <p className="mt-1 text-2xl font-semibold text-brand-dark">{naHoraDeVoltar}</p>
              <p className="text-[11px] text-brand-muted">
                {naHoraDeVoltar === 0 ? 'ninguém passou do prazo de repetir' : 'passaram do prazo de repetir o procedimento'}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
              Chamar <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
        <Nota>
          “Na hora de voltar” é a mesma lista do Dashboard (prazo de retorno de cada serviço), já sem quem
          tem horário marcado ou foi chamada nos últimos 14 dias.
        </Nota>
      </CardContent>
    </Card>
  )
}
