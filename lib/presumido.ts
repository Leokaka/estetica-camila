// Atendimento que já passou conta como feito e pago, a menos que alguém diga o contrário.
//
// Por que existe: o diagnóstico de 15/10/2026 mostrou que a Camila usa o sistema
// como AGENDA (marca com antecedência, à noite) e nunca como caixa. O último
// atendimento fechado era de 18/08; os botões "Atendi agora", "Recebi" e o card de
// pendências (25/09) tiveram uso zero. Não era atrito: ela simplesmente não volta
// no sistema depois de atender. Com o painel esperando confirmação, setembro e
// outubro apareciam como R$ 0 recebido — um número errado com cara de certo.
//
// Então a regra se inverte: o que passou e não foi cancelado conta como atendido
// e pago pelo valor cobrado. Ela só mexe na exceção (faltou, não pagou). Nada é
// gravado no banco — é só a forma de somar —, então dá pra desfazer apagando isto.
//
// O risco conhecido: falta que ela não registra vira receita. É por isso que o card
// de /agendamentos agora pergunta só "alguém faltou?" sobre a última semana.

type AgendamentoBase = {
  status: string
  data_hora: string
}

/** Passou do horário e ninguém fechou nem cancelou: é o que entra como presumido. */
export function passouSemConferir(ag: AgendamentoBase, agora: Date = new Date()) {
  return (ag.status === 'agendado' || ag.status === 'confirmado') && new Date(ag.data_hora) <= agora
}

/** Ainda vai acontecer — é o único agendado/confirmado que segue como "a receber". */
export function aindaVaiAcontecer(ag: AgendamentoBase, agora: Date = new Date()) {
  return (ag.status === 'agendado' || ag.status === 'confirmado') && new Date(ag.data_hora) > agora
}

// Uma semana é o que ela ainda lembra de cabeça se alguém faltou. Mais antigo que
// isso, perguntar só gera culpa e uma lista que cresce sem fim (chegou a 64) — e
// lista que só cresce é lista que ela para de abrir.
export const DIAS_PARA_CONFERIR = 7
