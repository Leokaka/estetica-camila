// Motor de disponibilidade de horários — regras reais de funcionamento da Camila Garcia Estética.
// Usado hoje pelo agendamento interno; é a mesma base que vai alimentar o agendamento
// self-service da cliente no futuro (ver ROADMAP.md).

export const HORARIO_FUNCIONAMENTO = {
  diasFuncionamento: [1, 2, 3, 4, 5, 6] as number[], // 0=dom ... 6=sáb — fechado só domingo
  abertura: '09:00',
  fechamento: '18:00',
  almocoInicio: '13:00',
  almocoFim: '14:00',
  grade: 15, // minutos entre horários candidatos
}

function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function paraHHMM(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function diaFunciona(data: Date): boolean {
  return HORARIO_FUNCIONAMENTO.diasFuncionamento.includes(data.getDay())
}

export interface OcupadoMin {
  inicio: number // minutos desde 00:00
  fim: number
}

/** Gera os horários de início disponíveis (formato "HH:mm") para uma duração de serviço,
 * já descontando almoço e conflitos com agendamentos existentes naquele dia. */
export function horariosDisponiveis(params: {
  duracaoMinutos: number
  ocupados: OcupadoMin[]
}): string[] {
  const { duracaoMinutos, ocupados } = params
  const { abertura, fechamento, almocoInicio, almocoFim, grade } = HORARIO_FUNCIONAMENTO
  const aberturaMin = paraMinutos(abertura)
  const fechamentoMin = paraMinutos(fechamento)
  const almocoIniMin = paraMinutos(almocoInicio)
  const almocoFimMin = paraMinutos(almocoFim)

  const slots: string[] = []
  for (let inicio = aberturaMin; inicio + duracaoMinutos <= fechamentoMin; inicio += grade) {
    const fim = inicio + duracaoMinutos
    const cruzaAlmoco = inicio < almocoFimMin && fim > almocoIniMin
    if (cruzaAlmoco) continue
    const conflita = ocupados.some(o => inicio < o.fim && fim > o.inicio)
    if (conflita) continue
    slots.push(paraHHMM(inicio))
  }
  return slots
}

/** Converte a lista de agendamentos de um dia (com data_hora ISO + duração do serviço)
 * em intervalos ocupados, em minutos — pronto pra passar pra horariosDisponiveis(). */
export function agendamentosParaOcupados(
  agendamentos: { data_hora: string; servico?: { duracao_minutos?: number } | null }[]
): OcupadoMin[] {
  return agendamentos.map(ag => {
    const d = new Date(ag.data_hora)
    const inicio = d.getHours() * 60 + d.getMinutes()
    const duracao = ag.servico?.duracao_minutos ?? 60
    return { inicio, fim: inicio + duracao }
  })
}
