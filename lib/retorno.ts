import { differenceInDays } from 'date-fns'

// "Na hora de voltar": clientes que já passaram da janela de retorno do próprio
// procedimento. Vivia dentro do dashboard; saiu pra cá quando o painel de
// Marketing passou a mostrar a mesma contagem — uma regra só, dois lugares.

/** Uma cliente que já passou da janela de retorno do próprio procedimento. */
export type Retorno = {
  id: string
  nome: string
  telefone: string | null
  servico: string
  /** Dias desde o último atendimento. */
  dias: number
  /** Em quantos dias esse procedimento costuma pedir repetição. */
  janela: number
  /** Passou de duas janelas: já não dá pra falar em "manter o resultado". */
  atrasada: boolean
}

// Depois de chamar a cliente, ela some do card por esse tempo. Sem isso a lista
// mostra os mesmos nomes todo dia e a Camila para de olhar pra ela.
export const CARENCIA_CONTATO_DIAS = 14
// Passou de 4 janelas, a chance de resposta é baixa e a lista vira cemitério.
export const LIMITE_JANELAS = 4
// Usado quando o procedimento ainda não tem janela cadastrada — é o valor que o
// card usava pra tudo antes de existir dias_retorno.
export const JANELA_PADRAO = 60

export type ClienteParaRetorno = {
  id: string
  nome: string
  telefone?: string | null
  contato_retorno_em?: string | null
  agendamentos?: { data_hora: string; status: string; servico_id: string }[]
}

/** Monta o mapa serviço → janela, caindo no padrão quando o serviço não tem dias_retorno. */
export function janelasPorServico(servicos: { id: string; nome: string; dias_retorno?: number | null }[]) {
  return new Map<string, { nome: string; dias: number }>(
    servicos.map(s => [
      s.id,
      { nome: s.nome, dias: Number(s.dias_retorno) > 0 ? Number(s.dias_retorno) : JANELA_PADRAO },
    ])
  )
}

export function clientesNaHoraDeVoltar(
  clientes: ClienteParaRetorno[],
  janelaPorServico: Map<string, { nome: string; dias: number }>,
  hoje: Date = new Date(),
): Retorno[] {
  const naHoraDeVoltar: Retorno[] = []
  for (const c of clientes) {
    const agendamentos = (c.agendamentos ?? []).filter(a => a.status !== 'cancelado')
    if (agendamentos.length === 0) continue

    // Quem já tem horário marcado não é cliente sumida — é cliente que volta
    // semana que vem. Chamar essa pessoa de volta é o tipo de mensagem que
    // queima a confiança no sistema.
    if (agendamentos.some(a => new Date(a.data_hora) > hoje)) continue

    const ultimo = [...agendamentos].sort((a, b) =>
      new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime()
    )[0]

    const servico = janelaPorServico.get(ultimo.servico_id)
    const janela = servico?.dias ?? JANELA_PADRAO
    const dias = differenceInDays(hoje, new Date(ultimo.data_hora))
    if (dias < janela) continue
    if (dias > janela * LIMITE_JANELAS) continue

    if (
      c.contato_retorno_em &&
      differenceInDays(hoje, new Date(c.contato_retorno_em)) < CARENCIA_CONTATO_DIAS
    ) continue

    naHoraDeVoltar.push({
      id: c.id,
      nome: c.nome,
      telefone: c.telefone ?? null,
      servico: servico?.nome ?? 'procedimento',
      dias,
      janela,
      atrasada: dias >= janela * 2,
    })
  }

  // Quem entrou na janela há menos tempo primeiro: é quem ainda está no hábito
  // e tem a maior chance de remarcar.
  naHoraDeVoltar.sort((a, b) => (a.dias - a.janela) - (b.dias - b.janela))
  return naHoraDeVoltar
}
