// Taxas reais da maquininha InfinitePay da Camila — conferidas em 15/08/2026 direto no
// app dela (Taxas > plano "1 Dia Útil"), bandeira Mastercard/Visa (a maioria dos cartões
// que ela recebe). Elo/Amex tem taxa um pouco mais alta na tabela dela, mas não vale a
// complexidade de pedir bandeira em cada pagamento — usamos Mastercard/Visa como padrão.
// Se a taxa da Camila mudar (planos da InfinitePay mudam com o faturamento dela), é só
// editar os números abaixo; nada mais no sistema precisa mudar.
export const TAXA_CARTAO_DEBITO = 1.37 // %

const TAXA_CARTAO_CREDITO_POR_PARCELA: Record<number, number> = {
  1: 3.15, 2: 5.39, 3: 6.12, 4: 6.85, 5: 7.57, 6: 8.28,
  7: 8.99, 8: 9.69, 9: 10.38, 10: 11.06, 11: 11.74, 12: 12.40,
}

export function taxaCartaoCredito(parcelas: number): number {
  const p = Math.min(Math.max(Math.round(parcelas) || 1, 1), 12)
  return TAXA_CARTAO_CREDITO_POR_PARCELA[p]
}
