// Cálculos do painel de Marketing. Tudo aqui é função pura sobre as linhas que a
// página traz do banco — dá pra conferir os números sem abrir o navegador.
//
// Regras que valem pro painel inteiro:
// - Dia, semana e mês sempre no fuso de São Paulo (o banco guarda em UTC).
// - "Atendimento feito" = horário já passou e não foi cancelado. A Camila quase
//   nunca marca "realizado" (ver lib/presumido.ts), então esperar o status faria
//   setembro e outubro parecerem vazios.
// - Faturamento = soma do valor_cobrado desses atendimentos feitos.
// - Eventos do site só existem desde 22/09/2026. Qualquer comparação de visitas ou
//   conversas com um período que começa antes disso não é feita — seria comparar
//   com "zero porque não media", não com "zero porque ninguém veio".

export const TZ = 'America/Sao_Paulo'
/** Dia em que a página /agende começou a registrar visitas e cliques. */
export const INICIO_MEDICAO = '2026-09-22'

// Sessões de teste feitas durante o desenvolvimento. As de prefixo 'teste-claude'
// se identificam sozinhas; 1003 foi uma conferência da migração com sessão
// aleatória, então vai pelo id.
const PREFIXO_TESTE = 'teste-claude'
const IDS_TESTE = new Set([1001, 1002, 1003])

const DIA_MS = 86_400_000

// ---------------------------------------------------------------------------
// Tipos das linhas que vêm do banco (só as colunas usadas)

export type EventoBruto = {
  id: number
  criado_em: string
  tipo: 'visita' | 'whatsapp' | 'instagram' | 'maps'
  origem: string | null
  sessao: string | null
}

export type AgendamentoBruto = {
  id: string
  cliente_id: string
  servico_id: string
  data_hora: string
  status: 'agendado' | 'confirmado' | 'realizado' | 'cancelado'
  valor_cobrado: number | string | null
}

export type ClienteBruto = {
  id: string
  nome: string
  telefone: string | null
  created_at: string
  origem: string | null
  contato_retorno_em: string | null
}

export type ServicoBruto = {
  id: string
  nome: string
  categoria: string | null
  preco: number | string | null
  custo: number | string | null
  dias_retorno: number | null
}

// ---------------------------------------------------------------------------
// Datas no fuso de São Paulo

const formatoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
})

/** 'YYYY-MM-DD' do instante, no horário de São Paulo. */
export function diaSP(instante: Date | string | number): string {
  return formatoDia.format(new Date(instante))
}

/** Meia-noite (de São Paulo) do dia. Brasil está sem horário de verão desde 2019: -03:00 fixo. */
export function inicioDoDia(dia: string): number {
  return new Date(`${dia}T00:00:00-03:00`).getTime()
}

function partes(dia: string) {
  const [a, m, d] = dia.split('-').map(Number)
  return { a, m, d }
}

export function somarDias(dia: string, n: number): string {
  const { a, m, d } = partes(dia)
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10)
}

export function diasNoMes(a: number, m: number) {
  return new Date(Date.UTC(a, m, 0)).getUTCDate()
}

/** 0 = segunda … 6 = domingo. */
export function diaDaSemana(dia: string) {
  const { a, m, d } = partes(dia)
  return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7
}

export function segundaDaSemana(dia: string) {
  return somarDias(dia, -diaDaSemana(dia))
}

const nomeMesLongo = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' })
const nomeMesCurto = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })

export function nomeDoMes(mes: string, curto = false) {
  const { a, m } = partes(`${mes}-01`)
  const nome = (curto ? nomeMesCurto : nomeMesLongo).format(new Date(Date.UTC(a, m - 1, 15)))
  return nome.replace('.', '')
}

export function rotuloDiaCurto(dia: string) {
  const { m, d } = partes(dia)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Dados preparados (feito uma vez por carregamento)

export type Atendimento = {
  id: string
  clienteId: string
  servicoId: string
  t: number
  dia: string
  valor: number
  /** Já aconteceu (horário passou). Futuro não cancelado = agenda à frente. */
  feito: boolean
  /** É o primeiro atendimento feito da história dessa cliente. */
  primeiroDaCliente: boolean
}

export type Evento = {
  t: number
  dia: string
  tipo: EventoBruto['tipo']
  origem: string | null
  sessao: string | null
}

export type ClientePreparada = {
  id: string
  nome: string
  telefone: string | null
  origem: string | null
  contatoRetornoEm: string | null
  /**
   * Quando ela chegou de verdade: o que vier primeiro entre o cadastro e o primeiro
   * agendamento. Sete clientes foram cadastradas depois de já terem sido atendidas
   * (importação de 27/07 e cadastros feitos depois), e pelo cadastro elas
   * apareceriam como "novas" meses depois de chegarem.
   */
  entrada: number
  entradaDia: string
  primeiroFeito: number | null
  qtdFeitos: number
}

export type Dados = {
  agora: number
  hoje: string
  eventos: Evento[]
  atendimentos: Atendimento[]
  clientes: Map<string, ClientePreparada>
  servicos: Map<string, ServicoBruto>
  /** Primeiro dia com qualquer dado de cliente/agendamento. */
  inicioDados: string
  /** Linhas ignoradas por serem teste. */
  eventosDeTeste: number
}

export function ehEventoDeTeste(e: Pick<EventoBruto, 'id' | 'sessao'>) {
  return IDS_TESTE.has(Number(e.id)) || (e.sessao ?? '').startsWith(PREFIXO_TESTE)
}

export function preparar(
  brutos: { eventos: EventoBruto[]; agendamentos: AgendamentoBruto[]; clientes: ClienteBruto[]; servicos: ServicoBruto[] },
  agoraData: Date = new Date(),
): Dados {
  const agora = agoraData.getTime()
  const hoje = diaSP(agora)

  let eventosDeTeste = 0
  const eventos: Evento[] = []
  for (const e of brutos.eventos) {
    if (ehEventoDeTeste(e)) { eventosDeTeste++; continue }
    const t = new Date(e.criado_em).getTime()
    eventos.push({ t, dia: diaSP(t), tipo: e.tipo, origem: e.origem || null, sessao: e.sessao })
  }

  const ativos = brutos.agendamentos
    .filter(a => a.status !== 'cancelado')
    .map((a): Atendimento => {
      const t = new Date(a.data_hora).getTime()
      return {
        id: a.id,
        clienteId: a.cliente_id,
        servicoId: a.servico_id,
        t,
        dia: diaSP(t),
        valor: Number(a.valor_cobrado) || 0,
        feito: t < agora,
        primeiroDaCliente: false,
      }
    })
    .sort((a, b) => a.t - b.t)

  const clientes = new Map<string, ClientePreparada>()
  for (const c of brutos.clientes) {
    const t = new Date(c.created_at).getTime()
    clientes.set(c.id, {
      id: c.id,
      nome: c.nome,
      telefone: c.telefone,
      origem: c.origem || null,
      contatoRetornoEm: c.contato_retorno_em,
      entrada: t,
      entradaDia: diaSP(t),
      primeiroFeito: null,
      qtdFeitos: 0,
    })
  }

  for (const a of ativos) {
    const c = clientes.get(a.clienteId)
    if (!c) continue
    if (a.t < c.entrada) { c.entrada = a.t; c.entradaDia = a.dia }
    if (a.feito) {
      if (c.primeiroFeito === null) { c.primeiroFeito = a.t; a.primeiroDaCliente = true }
      c.qtdFeitos++
    }
  }

  let inicioDados = hoje
  for (const c of clientes.values()) if (c.entradaDia < inicioDados) inicioDados = c.entradaDia
  if (ativos[0] && ativos[0].dia < inicioDados) inicioDados = ativos[0].dia

  return {
    agora,
    hoje,
    eventos,
    atendimentos: ativos,
    clientes,
    servicos: new Map(brutos.servicos.map(s => [s.id, s])),
    inicioDados,
    eventosDeTeste,
  }
}

// ---------------------------------------------------------------------------
// Períodos

export type PeriodoId = 'mes' | '7' | '15' | '30' | '90' | 'tudo'

export const PERIODOS: { id: PeriodoId; rotulo: string }[] = [
  { id: 'mes', rotulo: 'Este mês' },
  { id: '7', rotulo: '7 dias' },
  { id: '15', rotulo: '15 dias' },
  { id: '30', rotulo: '30 dias' },
  { id: '90', rotulo: '90 dias' },
  { id: 'tudo', rotulo: 'Tudo' },
]

/** Intervalo [ini, fim) em milissegundos, com os dias de São Paulo que ele cobre. */
export type Janela = { ini: number; fim: number; iniDia: string; fimDia: string }

export type Periodo = {
  id: PeriodoId
  atual: Janela
  anterior: Janela | null
  /** Ex.: "vs. setembro até dia 23", "vs. 30 dias antes". */
  rotuloComparacao: string | null
  /** Só em "Este mês". */
  mes?: {
    chave: string
    nome: string
    nomeAnterior: string
    chaveAnterior: string
    diaDoMes: number
    diasNoMes: number
    diasNoMesAnterior: number
  }
  dias: number
}

function janela(iniDia: string, fim: number): Janela {
  return { ini: inicioDoDia(iniDia), fim, iniDia, fimDia: diaSP(fim - 1) }
}

export function montarPeriodo(id: PeriodoId, dados: Pick<Dados, 'agora' | 'hoje' | 'inicioDados'>): Periodo {
  const { agora, hoje } = dados
  const desdeMeiaNoite = agora - inicioDoDia(hoje)

  if (id === 'mes') {
    const { a, m, d } = partes(hoje)
    const chave = hoje.slice(0, 7)
    const mesAnt = m === 1 ? { a: a - 1, m: 12 } : { a, m: m - 1 }
    const chaveAnterior = `${mesAnt.a}-${String(mesAnt.m).padStart(2, '0')}`
    const diasAnt = diasNoMes(mesAnt.a, mesAnt.m)
    // Mesmo dia do mês passado (ou o último dia, se o mês passado for mais curto),
    // na mesma hora de agora — compara manhã com manhã, não manhã com o dia inteiro.
    const diaCorte = `${chaveAnterior}-${String(Math.min(d, diasAnt)).padStart(2, '0')}`
    const fimAnterior = inicioDoDia(diaCorte) + desdeMeiaNoite
    return {
      id,
      atual: janela(`${chave}-01`, agora),
      anterior: janela(`${chaveAnterior}-01`, fimAnterior),
      rotuloComparacao: `vs. ${nomeDoMes(chaveAnterior)} até dia ${Math.min(d, diasAnt)}`,
      mes: {
        chave,
        nome: nomeDoMes(chave),
        nomeAnterior: nomeDoMes(chaveAnterior),
        chaveAnterior,
        diaDoMes: d,
        diasNoMes: diasNoMes(a, m),
        diasNoMesAnterior: diasAnt,
      },
      dias: d,
    }
  }

  if (id === 'tudo') {
    const iniDia = dados.inicioDados
    return {
      id,
      atual: janela(iniDia, agora),
      anterior: null,
      rotuloComparacao: null,
      dias: Math.round((inicioDoDia(hoje) - inicioDoDia(iniDia)) / DIA_MS) + 1,
    }
  }

  const n = Number(id)
  const iniDia = somarDias(hoje, -(n - 1))
  return {
    id,
    atual: janela(iniDia, agora),
    anterior: janela(somarDias(iniDia, -n), agora - n * DIA_MS),
    rotuloComparacao: `vs. ${n} dias antes`,
    dias: n,
  }
}

/** A janela começa depois que a medição do site já existia? */
export function medicaoCobre(j: Janela) {
  return j.ini >= inicioDoDia(INICIO_MEDICAO)
}

const dentro = (t: number, j: Janela) => t >= j.ini && t < j.fim

// ---------------------------------------------------------------------------
// Números principais

export type Metricas = {
  visitas: number
  pessoas: number
  conversas: number
  pessoasConversa: number
  instagram: number
  maps: number
  clientesNovas: number
  atendimentos: number
  faturamento: number
  ticket: number
}

export function calcularMetricas(dados: Dados, j: Janela): Metricas {
  let visitas = 0, conversas = 0, instagram = 0, maps = 0
  const sessoesVisita = new Set<string>()
  const sessoesConversa = new Set<string>()
  let conversasSemSessao = 0
  for (const e of dados.eventos) {
    if (!dentro(e.t, j)) continue
    if (e.tipo === 'visita') { visitas++; if (e.sessao) sessoesVisita.add(e.sessao) }
    else if (e.tipo === 'whatsapp') {
      conversas++
      if (e.sessao) sessoesConversa.add(e.sessao); else conversasSemSessao++
    }
    else if (e.tipo === 'instagram') instagram++
    else if (e.tipo === 'maps') maps++
  }

  let clientesNovas = 0
  for (const c of dados.clientes.values()) if (dentro(c.entrada, j)) clientesNovas++

  let atendimentos = 0, faturamento = 0
  for (const a of dados.atendimentos) {
    if (!a.feito || !dentro(a.t, j)) continue
    atendimentos++
    faturamento += a.valor
  }

  return {
    visitas,
    pessoas: sessoesVisita.size,
    conversas,
    pessoasConversa: sessoesConversa.size + conversasSemSessao,
    instagram,
    maps,
    clientesNovas,
    atendimentos,
    faturamento,
    ticket: atendimentos > 0 ? faturamento / atendimentos : 0,
  }
}

/** O que já está marcado do momento atual até o fim do mês corrente. */
export function agendaAFrenteNoMes(dados: Dados, periodo: Periodo) {
  if (!periodo.mes) return null
  const fimMes = inicioDoDia(`${periodo.mes.chave}-${String(periodo.mes.diasNoMes).padStart(2, '0')}`) + DIA_MS
  let qtd = 0, valor = 0
  for (const a of dados.atendimentos) {
    if (a.feito || a.t >= fimMes) continue
    qtd++
    valor += a.valor
  }
  return { qtd, valor }
}

/** Ritmo diário do mês × dias do mês. Antes do dia 3 o ritmo é chute, então não projeta. */
export function projetarMes(valor: number, periodo: Periodo): number | null {
  if (!periodo.mes || periodo.mes.diaDoMes < 3) return null
  return (valor / periodo.mes.diaDoMes) * periodo.mes.diasNoMes
}

export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null
  return Math.round(((atual - anterior) / anterior) * 100)
}

// ---------------------------------------------------------------------------
// Curva acumulada

export type MetricaCurva = 'visitas' | 'conversas' | 'clientesNovas' | 'faturamento'

export const METRICAS_CURVA: { id: MetricaCurva; rotulo: string; dinheiro?: boolean; doSite?: boolean }[] = [
  { id: 'visitas', rotulo: 'Visitas', doSite: true },
  { id: 'conversas', rotulo: 'Conversas', doSite: true },
  { id: 'clientesNovas', rotulo: 'Clientes novas' },
  { id: 'faturamento', rotulo: 'Faturamento', dinheiro: true },
]

function seriePorDia(dados: Dados, metrica: MetricaCurva): Map<string, number> {
  const mapa = new Map<string, number>()
  const somar = (dia: string, v: number) => mapa.set(dia, (mapa.get(dia) ?? 0) + v)
  if (metrica === 'visitas') for (const e of dados.eventos) { if (e.tipo === 'visita') somar(e.dia, 1) }
  if (metrica === 'conversas') for (const e of dados.eventos) { if (e.tipo === 'whatsapp') somar(e.dia, 1) }
  if (metrica === 'clientesNovas') for (const c of dados.clientes.values()) somar(c.entradaDia, 1)
  if (metrica === 'faturamento') for (const a of dados.atendimentos) { if (a.feito) somar(a.dia, a.valor) }
  return mapa
}

export type PontoCurva = {
  x: number
  dia: string
  diaAnterior: string | null
  atual: number | null
  anterior: number | null
  projecao: number | null
}

export type Curva = {
  pontos: PontoCurva[]
  temAnterior: boolean
  /** Explica por que a linha de comparação não aparece, quando não aparece. */
  avisoAnterior: string | null
  totalAtual: number
  totalAnterior: number | null
  projecaoFinal: number | null
  rotuloAtual: string
  rotuloAnterior: string | null
}

export function montarCurva(dados: Dados, periodo: Periodo, metrica: MetricaCurva): Curva {
  const porDia = seriePorDia(dados, metrica)
  const doSite = metrica === 'visitas' || metrica === 'conversas'
  const pontos: PontoCurva[] = []

  if (periodo.mes) {
    const { chave, chaveAnterior, diaDoMes, diasNoMes: total, diasNoMesAnterior, nome, nomeAnterior } = periodo.mes
    const anteriorValido = !doSite || inicioDoDia(`${chaveAnterior}-01`) >= inicioDoDia(INICIO_MEDICAO)
    let acum = 0, acumAnt = 0
    let totalAnteriorNoCorte = 0
    for (let x = 1; x <= total; x++) {
      const dia = `${chave}-${String(x).padStart(2, '0')}`
      let atual: number | null = null
      if (x <= diaDoMes) { acum += porDia.get(dia) ?? 0; atual = acum }
      let anterior: number | null = null
      let diaAnterior: string | null = null
      if (anteriorValido && x <= diasNoMesAnterior) {
        diaAnterior = `${chaveAnterior}-${String(x).padStart(2, '0')}`
        acumAnt += porDia.get(diaAnterior) ?? 0
        anterior = acumAnt
        if (x <= diaDoMes) totalAnteriorNoCorte = acumAnt
      }
      pontos.push({ x, dia, diaAnterior, atual, anterior, projecao: null })
    }
    const ritmo = acum / diaDoMes
    const projetar = diaDoMes >= 3 && diaDoMes < total
    if (projetar) {
      for (const p of pontos) if (p.x >= diaDoMes) p.projecao = acum + ritmo * (p.x - diaDoMes)
    }
    return {
      pontos,
      temAnterior: anteriorValido,
      avisoAnterior: anteriorValido ? null : `A medição do site começou em 22/09, então ${nomeAnterior} não tem mês inteiro pra comparar.`,
      totalAtual: acum,
      totalAnterior: anteriorValido ? totalAnteriorNoCorte : null,
      projecaoFinal: projetar ? acum + ritmo * (total - diaDoMes) : null,
      rotuloAtual: capitalizar(nome),
      rotuloAnterior: capitalizar(nomeAnterior),
    }
  }

  // Períodos de N dias e "Tudo": eixo = dia do período. Em "Tudo", as métricas do
  // site começam no dia em que a medição começou — antes disso a curva seria uma
  // linha reta em zero que só ocupa espaço.
  let iniDia = periodo.atual.iniDia
  if (doSite && iniDia < INICIO_MEDICAO) iniDia = INICIO_MEDICAO
  const n = Math.round((inicioDoDia(dados.hoje) - inicioDoDia(iniDia)) / DIA_MS) + 1
  const anteriorValido = !!periodo.anterior && (!doSite || medicaoCobre(periodo.anterior))
  let acum = 0, acumAnt = 0
  for (let i = 0; i < n; i++) {
    const dia = somarDias(iniDia, i)
    acum += porDia.get(dia) ?? 0
    let anterior: number | null = null
    let diaAnterior: string | null = null
    if (anteriorValido && periodo.anterior) {
      diaAnterior = somarDias(periodo.anterior.iniDia, i)
      acumAnt += porDia.get(diaAnterior) ?? 0
      anterior = acumAnt
    }
    pontos.push({ x: i + 1, dia, diaAnterior, atual: acum, anterior, projecao: null })
  }
  // O último dia do período anterior só vale até a mesma hora de hoje: sem isso o
  // anterior ganha um dia "cheio" contra um dia pela metade.
  if (anteriorValido && periodo.anterior && pontos.length > 0) {
    const ultimoAnt = pontos[pontos.length - 1]
    const corte = periodo.anterior.fim
    const diaCorte = ultimoAnt.diaAnterior!
    const extra = metrica === 'faturamento'
      ? dados.atendimentos.filter(a => a.feito && a.dia === diaCorte && a.t >= corte).reduce((s, a) => s + a.valor, 0)
      : metrica === 'clientesNovas'
        ? [...dados.clientes.values()].filter(c => c.entradaDia === diaCorte && c.entrada >= corte).length
        : dados.eventos.filter(e => e.dia === diaCorte && e.t >= corte && e.tipo === (metrica === 'visitas' ? 'visita' : 'whatsapp')).length
    ultimoAnt.anterior = (ultimoAnt.anterior ?? 0) - extra
  }
  const aviso = periodo.anterior && !anteriorValido
    ? 'O período anterior começa antes de 22/09, quando a medição do site começou — sem comparação justa.'
    : null
  return {
    pontos,
    temAnterior: anteriorValido,
    avisoAnterior: aviso,
    totalAtual: acum,
    totalAnterior: anteriorValido ? pontos[pontos.length - 1]?.anterior ?? 0 : null,
    projecaoFinal: null,
    rotuloAtual: periodo.id === 'tudo' ? 'Desde o início' : `Últimos ${periodo.dias} dias`,
    rotuloAnterior: anteriorValido ? `${periodo.dias} dias antes` : null,
  }
}

export function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ---------------------------------------------------------------------------
// Funil

export type Funil = {
  /** A janela do funil foi cortada em 22/09 porque o período começa antes. */
  cortado: boolean
  iniDia: string
  visitas: number
  pessoas: number
  clicaram: number
  clientesNovas: number
  primeiroFeito: number
  faturamentoNovas: number
  /** Só as etapas de cliente, para o pedaço do período antes da medição. */
  antes: { clientesNovas: number; primeiroFeito: number; faturamentoNovas: number; iniDia: string } | null
}

function etapasDeCliente(dados: Dados, j: Janela) {
  let clientesNovas = 0, primeiroFeito = 0, faturamentoNovas = 0
  const novas = new Set<string>()
  for (const c of dados.clientes.values()) {
    if (!dentro(c.entrada, j)) continue
    clientesNovas++
    novas.add(c.id)
    if (c.primeiroFeito !== null) primeiroFeito++
  }
  // Tudo que essas clientes já pagaram até hoje — inclui o que voltaram pra fazer
  // depois. É o que a chegada delas rendeu até agora.
  for (const a of dados.atendimentos) if (a.feito && novas.has(a.clienteId)) faturamentoNovas += a.valor
  return { clientesNovas, primeiroFeito, faturamentoNovas }
}

export function montarFunil(dados: Dados, periodo: Periodo): Funil {
  const medicao = inicioDoDia(INICIO_MEDICAO)
  const cortado = periodo.atual.ini < medicao
  const j: Janela = cortado ? { ...periodo.atual, ini: medicao, iniDia: INICIO_MEDICAO } : periodo.atual
  const m = calcularMetricas(dados, j)
  const clientes = etapasDeCliente(dados, j)
  const antes = cortado
    ? { ...etapasDeCliente(dados, { ...periodo.atual, fim: medicao, fimDia: somarDias(INICIO_MEDICAO, -1) }), iniDia: periodo.atual.iniDia }
    : null
  return {
    cortado,
    iniDia: j.iniDia,
    visitas: m.visitas,
    pessoas: m.pessoas,
    clicaram: m.pessoasConversa,
    ...clientes,
    antes,
  }
}

// ---------------------------------------------------------------------------
// Semana a semana e mês a mês

export type Semana = {
  segunda: string
  rotulo: string
  atendimentos: number
  faturamento: number
  mediaAtendimentos: number | null
  mediaFaturamento: number | null
  emCurso: boolean
}

export function montarSemanas(dados: Dados, quantas = 12): Semana[] {
  const atual = segundaDaSemana(dados.hoje)
  const total = quantas + 3 // 3 a mais pra média móvel já nascer cheia
  const semanas = Array.from({ length: total }, (_, i) => somarDias(atual, -7 * (total - 1 - i)))
  const idx = new Map(semanas.map((s, i) => [s, i]))
  const atend = new Array(total).fill(0)
  const fat = new Array(total).fill(0)
  for (const a of dados.atendimentos) {
    if (!a.feito) continue
    const i = idx.get(segundaDaSemana(a.dia))
    if (i === undefined) continue
    atend[i]++
    fat[i] += a.valor
  }
  const media = (arr: number[], i: number) => (arr[i] + arr[i - 1] + arr[i - 2] + arr[i - 3]) / 4
  const saida: Semana[] = []
  for (let i = 3; i < total; i++) {
    const emCurso = i === total - 1
    saida.push({
      segunda: semanas[i],
      rotulo: rotuloDiaCurto(semanas[i]),
      atendimentos: atend[i],
      faturamento: fat[i],
      // A semana em curso ainda está pela metade: entrar na média puxaria a linha
      // pra baixo toda segunda-feira sem nada ter mudado.
      mediaAtendimentos: emCurso ? null : media(atend, i),
      mediaFaturamento: emCurso ? null : media(fat, i),
      emCurso,
    })
  }
  return saida
}

export type Mes = {
  chave: string
  rotulo: string
  faturamento: number
  atendimentos: number
  clientesNovas: number
  ticket: number
  emCurso: boolean
}

export function montarMeses(dados: Dados): Mes[] {
  const ini = dados.inicioDados.slice(0, 7)
  const fim = dados.hoje.slice(0, 7)
  const meses: Mes[] = []
  let { a, m } = partes(`${ini}-01`)
  for (;;) {
    const chave = `${a}-${String(m).padStart(2, '0')}`
    meses.push({ chave, rotulo: nomeDoMes(chave, true), faturamento: 0, atendimentos: 0, clientesNovas: 0, ticket: 0, emCurso: chave === fim })
    if (chave >= fim) break
    m++
    if (m > 12) { m = 1; a++ }
  }
  const porChave = new Map(meses.map(x => [x.chave, x]))
  for (const at of dados.atendimentos) {
    if (!at.feito) continue
    const x = porChave.get(at.dia.slice(0, 7))
    if (x) { x.atendimentos++; x.faturamento += at.valor }
  }
  for (const c of dados.clientes.values()) {
    const x = porChave.get(c.entradaDia.slice(0, 7))
    if (x) x.clientesNovas++
  }
  for (const x of meses) x.ticket = x.atendimentos > 0 ? x.faturamento / x.atendimentos : 0
  return meses
}

// ---------------------------------------------------------------------------
// O que mais sai

export type LinhaServico = {
  nome: string
  categoria: string
  qtd: number
  faturamento: number
  ticket: number
  margem: number
}

/** Mesmo nome com espaço ou maiúscula diferente (há cadastros duplicados) vira uma linha só. */
function chaveNome(nome: string) {
  return nome.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function montarServicos(dados: Dados, j: Janela) {
  const linhas = new Map<string, LinhaServico>()
  const categorias = new Map<string, { qtd: number; faturamento: number }>()
  let semCusto = 0
  for (const a of dados.atendimentos) {
    if (!a.feito || !dentro(a.t, j)) continue
    const s = dados.servicos.get(a.servicoId)
    const nome = s?.nome.trim() || 'Serviço apagado'
    const categoria = s?.categoria || 'Sem categoria'
    const chave = chaveNome(nome)
    const linha = linhas.get(chave) ?? { nome, categoria, qtd: 0, faturamento: 0, ticket: 0, margem: 0 }
    linha.qtd++
    linha.faturamento += a.valor
    const preco = Number(s?.preco) || 0
    const custo = Number(s?.custo) || 0
    if (!custo) semCusto++
    linha.margem += preco - custo
    linhas.set(chave, linha)
    const cat = categorias.get(categoria) ?? { qtd: 0, faturamento: 0 }
    cat.qtd++
    cat.faturamento += a.valor
    categorias.set(categoria, cat)
  }
  const lista = [...linhas.values()]
  for (const l of lista) l.ticket = l.qtd > 0 ? l.faturamento / l.qtd : 0
  return {
    servicos: lista,
    categorias: [...categorias.entries()].map(([nome, v]) => ({ nome, ...v })),
    margemTotal: lista.reduce((s, l) => s + l.margem, 0),
    faturamentoTotal: lista.reduce((s, l) => s + l.faturamento, 0),
    qtdTotal: lista.reduce((s, l) => s + l.qtd, 0),
    semCusto,
  }
}

// ---------------------------------------------------------------------------
// Clientes

export function montarClientes(dados: Dados, j: Janela) {
  const primeira = { atendimentos: 0, faturamento: 0, clientes: new Set<string>() }
  const voltaram = { atendimentos: 0, faturamento: 0, clientes: new Set<string>() }
  for (const a of dados.atendimentos) {
    if (!a.feito || !dentro(a.t, j)) continue
    const g = a.primeiroDaCliente ? primeira : voltaram
    g.atendimentos++
    g.faturamento += a.valor
    g.clientes.add(a.clienteId)
  }
  let comAtendimento = 0, comDoisOuMais = 0
  for (const c of dados.clientes.values()) {
    if (c.qtdFeitos >= 1) comAtendimento++
    if (c.qtdFeitos >= 2) comDoisOuMais++
  }
  return {
    primeira: { atendimentos: primeira.atendimentos, faturamento: primeira.faturamento, clientes: primeira.clientes.size },
    voltaram: { atendimentos: voltaram.atendimentos, faturamento: voltaram.faturamento, clientes: voltaram.clientes.size },
    comAtendimento,
    comDoisOuMais,
    taxaRetorno: comAtendimento > 0 ? comDoisOuMais / comAtendimento : 0,
  }
}

// ---------------------------------------------------------------------------
// Quando acontece (sempre o histórico inteiro — com o volume de hoje, recortar
// por período deixaria 1 ou 2 por dia da semana, que não decide nada)

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function montarDiasDaSemana(dados: Dados) {
  const linhas = DIAS_SEMANA.map(rotulo => ({ rotulo, visitas: 0, conversas: 0, atendimentos: 0 }))
  for (const e of dados.eventos) {
    const l = linhas[diaDaSemana(e.dia)]
    if (e.tipo === 'visita') l.visitas++
    if (e.tipo === 'whatsapp') l.conversas++
  }
  for (const a of dados.atendimentos) if (a.feito) linhas[diaDaSemana(a.dia)].atendimentos++
  return linhas
}

// ---------------------------------------------------------------------------
// De onde vem

export function montarOrigens(dados: Dados, j: Janela) {
  const porOrigem = new Map<string, { visitas: number; conversas: number }>()
  for (const e of dados.eventos) {
    if (!dentro(e.t, j)) continue
    if (e.tipo !== 'visita' && e.tipo !== 'whatsapp') continue
    const chave = e.origem ?? '__direto'
    const linha = porOrigem.get(chave) ?? { visitas: 0, conversas: 0 }
    if (e.tipo === 'visita') linha.visitas++
    else linha.conversas++
    porOrigem.set(chave, linha)
  }

  // Faturamento no período por "Como conheceu?" do cadastro. Vale pra trás também:
  // se ela preencher a origem de uma cliente antiga, o histórico dela entra aqui.
  const faturamentoPorComoConheceu = new Map<string, number>()
  for (const a of dados.atendimentos) {
    if (!a.feito || !dentro(a.t, j)) continue
    const origem = dados.clientes.get(a.clienteId)?.origem ?? '__nao_informado'
    faturamentoPorComoConheceu.set(origem, (faturamentoPorComoConheceu.get(origem) ?? 0) + a.valor)
  }
  let clientesComOrigem = 0
  for (const c of dados.clientes.values()) if (c.origem) clientesComOrigem++

  return {
    linhas: [...porOrigem.entries()]
      .map(([chave, v]) => ({ chave, ...v, taxa: v.visitas > 0 ? v.conversas / v.visitas : 0 }))
      .sort((a, b) => b.visitas - a.visitas || b.conversas - a.conversas),
    faturamentoPorComoConheceu,
    clientesComOrigem,
    totalClientes: dados.clientes.size,
  }
}

// Nome bonito de cada origem. A chave é o ?origem= que vai no link publicado —
// é isso que liga cada visita ao lugar onde o link foi colado.
export const NOME_ORIGEM: Record<string, string> = {
  instagram: 'Instagram',
  google: 'Google (perfil)',
  plasma: 'Anúncio · jato de plasma',
  limpeza: 'Anúncio · limpeza de pele',
  cilios: 'Anúncio · cílios',
  corporal: 'Anúncio · drenagem e massagem',
  panfleto: 'Panfleto (QR)',
  cartao: 'Cartão de visita',
}
export const ORIGEM_SEM_MARCA = 'Direto ou link sem marcação'

export function nomeOrigem(chave: string) {
  return chave === '__direto' ? ORIGEM_SEM_MARCA : (NOME_ORIGEM[chave] ?? chave)
}

// ---------------------------------------------------------------------------
// Resumo em frases. Só sai frase quando o número aguenta a frase: com 2
// atendimentos, "subiu 100%" é ruído com cara de notícia.

const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export function montarResumo(
  periodo: Periodo,
  m: Metricas,
  mAnt: Metricas | null,
  origens: ReturnType<typeof montarOrigens>,
  servicos: ReturnType<typeof montarServicos>,
): string[] {
  const frases: string[] = []

  if (mAnt && mAnt.faturamento > 0 && m.atendimentos >= 3 && mAnt.atendimentos >= 3) {
    const v = variacao(m.faturamento, mAnt.faturamento)!
    const proj = projetarMes(m.faturamento, periodo)
    if (periodo.mes) {
      const base = Math.abs(v) < 5
        ? `O faturamento do mês está no mesmo passo de ${periodo.mes.nomeAnterior} no mesmo dia`
        : `O faturamento do mês está ${Math.abs(v)}% ${v > 0 ? 'acima' : 'abaixo'} de ${periodo.mes.nomeAnterior} no mesmo dia`
      frases.push(proj !== null ? `${base}; no ritmo atual, fecha perto de ${brl0.format(proj)}.` : `${base}.`)
    } else {
      frases.push(Math.abs(v) < 5
        ? `Os últimos ${periodo.dias} dias faturaram quase o mesmo que os ${periodo.dias} anteriores.`
        : `Os últimos ${periodo.dias} dias faturaram ${Math.abs(v)}% ${v > 0 ? 'a mais' : 'a menos'} que os ${periodo.dias} anteriores.`)
    }
  } else if (periodo.mes && m.atendimentos >= 3) {
    const proj = projetarMes(m.faturamento, periodo)
    if (proj !== null) frases.push(`No ritmo atual, o mês fecha perto de ${brl0.format(proj)}.`)
  }

  if (m.visitas >= 5 && origens.linhas.length > 0) {
    const topo = origens.linhas[0]
    const deDez = Math.round((topo.visitas / m.visitas) * 10)
    if (deDez >= 5) {
      frases.push(topo.chave === '__direto'
        ? `${deDez} de cada 10 visitas chegaram sem marcação de origem.`
        : `${nomeOrigem(topo.chave)} trouxe ${deDez} de cada 10 visitas.`)
    }
  }

  if (servicos.qtdTotal >= 3 && servicos.categorias.length > 1) {
    const cat = [...servicos.categorias].sort((a, b) => b.faturamento - a.faturamento)[0]
    const pct = Math.round((cat.faturamento / servicos.faturamentoTotal) * 100)
    frases.push(`${cat.nome} foi o que mais faturou: ${pct}% do total.`)
  }

  return frases.slice(0, 3)
}
