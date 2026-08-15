// Taxas reais da InfinitePay da Camila — conferidas em 15/08/2026 direto no app dela.
// Existem DOIS planos com taxas diferentes: maquininha física (Smart/InfiniteTap) e
// link de pagamento (cobrança online). Se a taxa mudar ou ela adicionar outro canal, é
// só editar os números abaixo; nada mais no sistema precisa mudar.
export const TAXA_CARTAO_DEBITO = 1.37 // % (maquininha — débito só existe físico)

// Maquininha física, plano "1 Dia Útil", Mastercard/Visa.
const TAXA_MAQUININHA_POR_PARCELA: Record<number, number> = {
  1: 3.15, 2: 5.39, 3: 6.12, 4: 6.85, 5: 7.57, 6: 8.28,
  7: 8.99, 8: 9.69, 9: 10.38, 10: 11.06, 11: 11.74, 12: 12.40,
}

// Link de pagamento (cobrança online), plano "1 Dia Útil", Mastercard/Visa/Elo/Amex.
const TAXA_LINK_POR_PARCELA: Record<number, number> = {
  1: 4.20, 2: 6.09, 3: 7.01, 4: 7.91, 5: 8.80, 6: 9.67,
  7: 12.59, 8: 13.42, 9: 14.25, 10: 15.06, 11: 15.87, 12: 16.66,
}

export type CanalCartao = 'maquininha' | 'link'

export function taxaCartaoCredito(parcelas: number, canal: CanalCartao = 'maquininha'): number {
  const p = Math.min(Math.max(Math.round(parcelas) || 1, 1), 12)
  return canal === 'link' ? TAXA_LINK_POR_PARCELA[p] : TAXA_MAQUININHA_POR_PARCELA[p]
}
