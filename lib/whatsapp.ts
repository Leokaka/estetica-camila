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

export function linkWhatsApp(telefone: string, texto: string) {
  const d = telefone.replace(/\D/g, '')
  const num = d.length <= 11 ? `55${d}` : d
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
}
