'use client'

import { ORIGENS } from '@/lib/origem'

type Props = {
  origem: string
  indicadaPor: string
  onChange: (valor: { origem: string; indicadaPor: string }) => void
  /** Clientes que podem ter indicado — a própria cliente em edição já vem fora. */
  clientes: { id: string; nome: string }[]
}

// Chips em vez de select: é um toque só, e ela vê as opções sem abrir nada.
// Opcional de propósito — campo obrigatório que ela não sabe responder vira
// "Outro" chutado, e aí o número mente. Melhor vazio que errado.
export function CampoOrigem({ origem, indicadaPor, onChange, clientes }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        Como conheceu? <span className="font-normal text-brand-muted-soft">(opcional)</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ORIGENS.map(o => {
          const ativo = origem === o.valor
          return (
            <button
              key={o.valor}
              type="button"
              // Tocar de novo desmarca: escolheu errado, volta pro vazio.
              onClick={() => onChange({ origem: ativo ? '' : o.valor, indicadaPor: ativo || o.valor !== 'indicacao' ? '' : indicadaPor })}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                ativo ? 'border-primary bg-primary text-primary-foreground' : 'border-brand-border bg-brand-card hover:border-primary'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {origem === 'indicacao' && (
        // Select nativo: no celular abre a roda do próprio sistema, que rola bem
        // com 40 nomes — mais leve que um combobox dentro de outro formulário.
        <select
          aria-label="Quem indicou"
          value={indicadaPor}
          onChange={e => onChange({ origem, indicadaPor: e.target.value })}
          className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">Quem indicou? (se souber)</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      )}
    </div>
  )
}
