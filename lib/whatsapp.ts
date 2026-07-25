import { format } from 'date-fns'

export const ENDERECO = 'Rua São Teodoro, 833 · Vila Carmosina (2º andar)'
export const PROMO_LABEL = '15% de inauguração'

export function mensagemConfirmacao(nome: string, servico: string, dataHora: Date, valor: number, promo: boolean) {
  const data = format(dataHora, 'dd/MM/yyyy')
  const hora = format(dataHora, 'HH:mm')
  return `Oi, ${nome.split(' ')[0]}! Aqui é a Camila 💛\n\nSeu agendamento está confirmado:\n✨ ${servico}\n📅 ${data} às ${hora}\n💰 R$ ${valor}${promo ? ` (com ${PROMO_LABEL})` : ''}\n📍 ${ENDERECO}\n\nQualquer coisa é só me chamar por aqui. Até lá! 😊`
}

export function linkWhatsApp(telefone: string, texto: string) {
  const d = telefone.replace(/\D/g, '')
  const num = d.length <= 11 ? `55${d}` : d
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
}
