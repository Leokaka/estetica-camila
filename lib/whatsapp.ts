import { format } from 'date-fns'

export const ENDERECO = 'Rua São Teodoro, 833 · Vila Carmosina (2º andar)'
export const PROMO_LABEL = '15% de inauguração'

export function mensagemConfirmacao(nome: string, servico: string, dataHora: Date, valor: number, promo: boolean) {
  const data = format(dataHora, 'dd/MM/yyyy')
  const hora = format(dataHora, 'HH:mm')
  return `Oi, ${nome.split(' ')[0]}! Aqui é a Camila 💛\n\nSeu agendamento está confirmado:\n✨ ${servico}\n📅 ${data} às ${hora}\n💰 R$ ${valor}${promo ? ` (com ${PROMO_LABEL})` : ''}\n📍 ${ENDERECO}\n\nQualquer coisa é só me chamar por aqui. Até lá! 😊`
}

/** Mensagem pós-atendimento, pra quando o agendamento já foi marcado como realizado. */
export function mensagemAgradecimento(nome: string, servico: string) {
  return `Oi, ${nome.split(' ')[0]}! Aqui é a Camila 💛\n\nMuito obrigada por confiar no meu trabalho hoje! Espero que tenha amado o resultado do seu ${servico} ✨\n\nQualquer dúvida ou cuidado depois do procedimento, é só me chamar por aqui. Até a próxima! 😊`
}

/** Lembrete de véspera — pra mandar de uma vez pra quem tem atendimento amanhã. */
export function mensagemLembrete(nome: string, servico: string, dataHora: Date) {
  const hora = format(dataHora, 'HH:mm')
  return `Oi, ${nome.split(' ')[0]}! Aqui é a Camila 💛\n\nSó lembrando do seu horário amanhã: ${servico} às ${hora}. Te espero! 😊\n📍 ${ENDERECO}`
}

/** Abertura de conversa avulsa, sem contexto de agendamento — usada no card de Clientes. */
export function mensagemGenerica(nome: string) {
  return `Oi, ${nome.split(' ')[0]}! Aqui é a Camila 💛`
}

/**
 * Chamada de retorno para quem está na janela do próprio procedimento.
 * Cita o procedimento de propósito: "faz 24 dias do seu volume brasileiro" convence
 * muito mais do que "faz tempo que você não aparece", porque dá um motivo concreto
 * pra voltar agora em vez de um dia desses.
 */
export function mensagemRetorno(nome: string, servico: string, dias: number) {
  return `Oi, ${nome.split(' ')[0]}! Aqui é a Camila 💛\n\nVi aqui que já faz ${dias} dias do seu ${servico} — costuma ser mais ou menos nessa época que vale repetir pra manter o resultado bonito.\n\nQuer que eu separe um horário pra você essa semana? 😊`
}

/**
 * Para quem passou bem da janela. Aqui cobrar o ritmo soa mal — já não dá pra
 * "manter o resultado", então a mensagem convida a retomar, sem cobrança.
 */
export function mensagemRetomada(nome: string, servico: string) {
  return `Oi, ${nome.split(' ')[0]}! Aqui é a Camila 💛\n\nFaz um tempinho que você não aparece por aqui, que saudade!\n\nSe quiser retomar seu ${servico}, me fala qual dia e período ficam melhores pra você que eu dou um jeito de te encaixar 😊`
}

export function linkWhatsApp(telefone: string, texto: string) {
  const d = telefone.replace(/\D/g, '')
  const num = d.length <= 11 ? `55${d}` : d
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
}
