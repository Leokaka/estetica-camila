'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Cores dos gráficos. Derivadas da paleta da marca (cacau/dourado), mas com um
// pouco mais de saturação: os tons oficiais são tão suaves que, como traço fino
// de 2px, liam como cinza. O par passou no validador de daltonismo (ΔE ~20).
// O dourado fica abaixo de 3:1 contra o fundo — por isso todo gráfico que usa
// ele traz legenda e número escrito ao lado, nunca só a cor.
export const COR = {
  serie1: '#95532B',
  serie2: '#C9963A',
  /** Período de comparação: contexto, não protagonista. */
  contexto: '#C9B8A6',
  grade: '#EDE5DA',
  eixo: '#D9CCBC',
  texto: '#8A7160',
  textoForte: '#2E2015',
}

export const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
export const brlCentavos = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const formatoCompacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

export function formatar(valor: number, dinheiro?: boolean) {
  return dinheiro ? brl.format(valor) : inteiro.format(valor)
}

/**
 * Ticks de eixo: "950", "2,9 mil". Sem "R$" de propósito — no celular o eixo tem
 * ~50px e o prefixo quebrava cada tick em duas linhas. O título e os números
 * escritos acima do gráfico já dizem que é dinheiro.
 */
export function formatarEixo(valor: number) {
  return Math.abs(valor) < 1000 ? inteiro.format(valor) : formatoCompacto.format(valor)
}

export function pct(fracao: number) {
  return `${Math.round(fracao * 100)}%`
}

export function TituloSecao({ titulo, sub, acao, icone }: { titulo: string; sub?: ReactNode; acao?: ReactNode; icone?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-heading text-lg font-medium text-brand-dark">
          {icone}
          {titulo}
        </h2>
        {sub && <p className="mt-0.5 text-xs leading-relaxed text-brand-muted">{sub}</p>}
      </div>
      {acao}
    </div>
  )
}

/** Controle segmentado (pílulas). Um toque, sem abrir menu. */
export function Segmentado<T extends string>({
  opcoes, valor, onChange, rotulo, className, compacto,
}: {
  opcoes: { id: T; rotulo: string }[]
  valor: T
  onChange: (v: T) => void
  rotulo: string
  className?: string
  /** Botões mais estreitos — pra caber 6 opções numa linha no celular. */
  compacto?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className={cn('inline-flex flex-wrap gap-1 rounded-xl bg-brand-surface p-1', className)}>
      {opcoes.map(o => {
        const ativo = o.id === valor
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(o.id)}
            className={cn(
              'min-h-8 whitespace-nowrap rounded-lg text-xs font-medium transition-colors',
              compacto ? 'px-1 sm:px-3' : 'px-2.5',
              ativo
                ? 'bg-brand-card text-brand-dark shadow-[0_1px_2px_rgba(46,32,21,0.08),0_1px_6px_rgba(46,32,21,0.06)]'
                : 'text-brand-muted hover:text-brand-dark',
            )}
          >
            {o.rotulo}
          </button>
        )
      })}
    </div>
  )
}

/** Chave da legenda: traço ou bloco na cor da série, texto sempre na cor de texto. */
export function ItemLegenda({ cor, rotulo, tipo = 'linha', tracejado }: { cor: string; rotulo: string; tipo?: 'linha' | 'bloco'; tracejado?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-brand-text-soft">
      {tipo === 'linha' ? (
        <svg width="16" height="8" aria-hidden className="shrink-0">
          <line x1="1" y1="4" x2="15" y2="4" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeDasharray={tracejado ? '3 3' : undefined} />
        </svg>
      ) : (
        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: cor }} />
      )}
      {rotulo}
    </span>
  )
}

export type LinhaTooltip = { cor: string; rotulo: string; valor: string; tracejado?: boolean }

export function CaixaTooltip({ titulo, linhas }: { titulo: string; linhas: LinhaTooltip[] }) {
  if (linhas.length === 0) return null
  return (
    <div className="min-w-36 rounded-xl border border-brand-border bg-brand-card px-3 py-2 text-xs shadow-[0_4px_16px_rgba(46,32,21,0.10)]">
      <p className="mb-1 font-medium text-brand-dark">{titulo}</p>
      <div className="space-y-0.5">
        {linhas.map(l => (
          <div key={l.rotulo} className="flex items-center justify-between gap-4">
            <ItemLegenda cor={l.cor} rotulo={l.rotulo} tracejado={l.tracejado} />
            <span className="font-medium tabular-nums text-brand-dark">{l.valor}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Nota({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[11px] leading-relaxed text-brand-muted', className)}>{children}</p>
}

/** "Ver em números": a tabela gêmea de cada gráfico, recolhida por padrão. */
export function VerEmNumeros({ children }: { children: ReactNode }) {
  return (
    <details className="group mt-3">
      <summary className="cursor-pointer list-none text-xs font-medium text-brand-text-soft hover:text-brand-dark [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90">›</span> Ver em números
      </summary>
      <div className="mt-2 overflow-x-auto">{children}</div>
    </details>
  )
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-brand-border/60', className)} />
}
