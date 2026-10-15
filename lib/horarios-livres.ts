import { addDays, format, isSameDay, startOfDay } from 'date-fns'
import { paraMinutos, HORARIO_FUNCIONAMENTO, type OcupadoMin } from '@/lib/agenda'
import { ENDERECO } from '@/lib/whatsapp'

// Texto de "horários livres da semana" pra ela postar no status do WhatsApp e nos
// stories.
//
// Por que existe: em out/2026 a agenda ocupava uns 30% do tempo (8 atendimentos
// por semana, R$ 101 de média) e segunda/terça eram os dias mais vazios. Cada
// horário vazio é faturamento que não volta. O status do WhatsApp é visto
// justamente por quem já tem o número dela — clientes e conhecidas —, então é o
// alcance mais barato e mais certeiro que existe. O sistema já sabe o que está
// livre; só faltava transformar isso em texto.

// Janela que vale divulgar. A agenda aceita 07h–20h (lib/agenda.ts), mas anunciar
// "livre às 7h" atrai pedido que ela talvez não queira. Ponto de partida pra
// conversar com a Camila — o texto sai editável de qualquer jeito.
export const DIVULGAR_DE = '09:00'
export const DIVULGAR_ATE = '19:00'
// Janela menor que isso não cabe nem um design de sobrancelha com folga; anunciar
// gera conversa que termina em "esse horário não dá".
const JANELA_MINIMA = 60
// No histórico até out/2026, zero atendimentos em domingo. Divulgar domingo seria
// oferecer o que ela não faz.
const DIAS_QUE_NAO_DIVULGA = [0]
const GRADE = HORARIO_FUNCIONAMENTO.grade
// Nome do dia escrito à mão: o "EEEEEE" do date-fns sai "sab", sem acento, e
// esse texto é público.
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export type DiaLivre = { dia: Date; janelas: { inicio: number; fim: number }[] }

/** Buracos de pelo menos JANELA_MINIMA dentro da janela de divulgação. */
export function janelasLivres(ocupados: OcupadoMin[], aPartirDe = paraMinutos(DIVULGAR_DE)) {
  const fimDia = paraMinutos(DIVULGAR_ATE)
  const ordenados = [...ocupados].sort((a, b) => a.inicio - b.inicio)
  const janelas: { inicio: number; fim: number }[] = []
  let cursor = aPartirDe
  for (const o of ordenados) {
    if (o.fim <= cursor) continue
    if (o.inicio - cursor >= JANELA_MINIMA) janelas.push({ inicio: cursor, fim: Math.min(o.inicio, fimDia) })
    // Arredonda pra grade da agenda: atendimento de 80 min termina 10h20, mas o
    // horário que dá pra marcar (e que faz sentido anunciar) é 10h30.
    cursor = Math.max(cursor, Math.ceil(o.fim / GRADE) * GRADE)
    if (cursor >= fimDia) break
  }
  if (fimDia - cursor >= JANELA_MINIMA) janelas.push({ inicio: cursor, fim: fimDia })
  return janelas.filter(j => j.fim - j.inicio >= JANELA_MINIMA)
}

/**
 * Próximos dias com algum buraco. Hoje entra só se ainda sobra janela depois de
 * agora (arredondado pra próxima meia hora, pra não anunciar horário que já começou).
 */
export function diasLivres(
  ocupadosDoDia: (dia: Date) => OcupadoMin[],
  quantidadeDias = 7,
  agora = new Date(),
): DiaLivre[] {
  const resultado: DiaLivre[] = []
  for (let i = 0; i < quantidadeDias; i++) {
    const dia = startOfDay(addDays(agora, i))
    if (DIAS_QUE_NAO_DIVULGA.includes(dia.getDay())) continue
    let aPartirDe = paraMinutos(DIVULGAR_DE)
    if (isSameDay(dia, agora)) {
      const minutosAgora = agora.getHours() * 60 + agora.getMinutes()
      aPartirDe = Math.max(aPartirDe, Math.ceil(minutosAgora / 30) * 30)
    }
    const janelas = janelasLivres(ocupadosDoDia(dia), aPartirDe)
    if (janelas.length > 0) resultado.push({ dia, janelas })
  }
  return resultado
}

function hora(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

function descreverJanela(j: { inicio: number; fim: number }) {
  if (j.inicio === paraMinutos(DIVULGAR_DE) && j.fim === paraMinutos(DIVULGAR_ATE)) return 'livre o dia todo'
  if (j.fim === paraMinutos(DIVULGAR_ATE)) return `a partir das ${hora(j.inicio)}`
  return `${hora(j.inicio)} às ${hora(j.fim)}`
}

export function textoHorariosLivres(dias: DiaLivre[]) {
  if (dias.length === 0) return ''
  const linhas = dias.map(d => {
    const nomeDia = `${DIAS[d.dia.getDay()]} ${format(d.dia, 'dd/MM')}`
    return `▫️ ${nomeDia} · ${d.janelas.map(descreverJanela).join(', ')}`
  })
  return `✨ Horários livres essa semana ✨\n\n${linhas.join('\n')}\n\nMe chama aqui pra reservar o seu 💛\n📍 ${ENDERECO}`
}
