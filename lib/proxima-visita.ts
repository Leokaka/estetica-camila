import { addDays, format, startOfDay } from 'date-fns'
import type { Servico } from '@/types'

// Sugestão de "marcar de novo" a partir do histórico da cliente.
//
// Por que existe: no diagnóstico de 15/10/2026, 43 dos 87 agendamentos eram
// manutenção de cílios — a mesma cliente, o mesmo procedimento, a cada ~3 semanas.
// Pra cada uma, a Camila buscava a cliente, buscava o serviço, achava a data e
// caçava o horário. A agenda dela é quase toda repetição; o sistema já sabe o que
// vem a seguir e só precisa oferecer.

export type ItemHistorico = {
  id: string
  cliente_id: string
  servico_id: string
  data_hora: string
  status: string
}

export type Sugestao = {
  servico: Servico
  /** yyyy-MM-dd — null quando a data ideal já passou (cliente atrasada): aí a data é a que ela combinar. */
  data: string | null
  /** HH:mm do último atendimento — cliente de manutenção costuma ter horário fixo. */
  hora: string
  ultimaVisita: Date
  ultimoServicoNome: string
  /** Veio de uma colocação e a sugestão é a manutenção correspondente. */
  virouManutencao: boolean
}

const PALAVRAS_GENERICAS = new Set(['manutencao', 'volume', 'colocacao', 'de', 'da', 'do', 'e', 'cilios', 'fio', 'a'])

function palavras(nome: string) {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(p => p && !PALAVRAS_GENERICAS.has(p))
}

/**
 * Quem fez colocação de cílios volta pra MANUTENÇÃO, não pra outra colocação.
 * O par é achado pelo nome que a própria Camila cadastrou ("Volume Brasileiro" →
 * "Manutenção Brasileiro", "Fox Eyes" → "Manutenção Fox Eyes"), então continua
 * funcionando se ela criar um estilo novo seguindo o mesmo padrão de nome.
 */
export function servicoDeContinuacao(ultimo: Servico, ativos: Servico[]): { servico: Servico; virouManutencao: boolean } | null {
  const ehManutencao = /manuten/i.test(ultimo.nome)
  if (ultimo.categoria === 'Cílios' && !ehManutencao) {
    const chave = palavras(ultimo.nome)
    const par = chave.length > 0 && ativos.find(s =>
      /manuten/i.test(s.nome) && palavras(s.nome).length > 0 && palavras(s.nome).every(p => chave.includes(p))
    )
    if (par) return { servico: par, virouManutencao: true }
  }
  // Serviço desativado não volta como sugestão: ela tirou de linha por algum motivo.
  const aindaAtivo = ativos.find(s => s.id === ultimo.id)
  return aindaAtivo ? { servico: aindaAtivo, virouManutencao: false } : null
}

/** Último atendimento que já aconteceu (não cancelado) e o próximo que já está marcado. */
export function situacaoDaCliente(clienteId: string, historico: ItemHistorico[], agora = new Date()) {
  const daCliente = historico
    .filter(h => h.cliente_id === clienteId && h.status !== 'cancelado')
    .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
  const passados = daCliente.filter(h => new Date(h.data_hora) <= agora)
  return {
    ultimo: passados[passados.length - 1] ?? null,
    proximo: daCliente.find(h => new Date(h.data_hora) > agora) ?? null,
  }
}

export function sugerirProximaVisita(
  clienteId: string,
  historico: ItemHistorico[],
  todosServicos: Servico[],
  ativos: Servico[],
  agora = new Date(),
): Sugestao | null {
  const { ultimo } = situacaoDaCliente(clienteId, historico, agora)
  if (!ultimo) return null
  const servicoUltimo = todosServicos.find(s => s.id === ultimo.servico_id)
  if (!servicoUltimo) return null
  const continuacao = servicoDeContinuacao(servicoUltimo, ativos)
  if (!continuacao) return null

  const ultimaVisita = new Date(ultimo.data_hora)
  const dias = continuacao.servico.dias_retorno ?? servicoUltimo.dias_retorno
  const alvo = dias ? startOfDay(addDays(ultimaVisita, dias)) : null
  // Data ideal já passou: sugerir um dia no passado não serve, e "amanhã" seria
  // chute. Fica só o serviço e o horário; o dia é o que ela combinar com a cliente.
  const data = alvo && alvo >= startOfDay(agora) ? format(alvo, 'yyyy-MM-dd') : null

  return {
    servico: continuacao.servico,
    data,
    hora: format(ultimaVisita, 'HH:mm'),
    ultimaVisita,
    ultimoServicoNome: servicoUltimo.nome,
    virouManutencao: continuacao.virouManutencao,
  }
}
