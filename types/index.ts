export interface Cliente {
  id: string
  nome: string
  telefone: string
  email?: string
  data_nascimento?: string
  observacoes?: string
  created_at: string
}

export interface Servico {
  id: string
  nome: string
  descricao?: string
  preco: number
  custo: number
  duracao_minutos: number
  categoria: string
  ativo: boolean
  created_at: string
}

export interface Agendamento {
  id: string
  cliente_id: string
  servico_id: string
  data_hora: string
  status: 'agendado' | 'confirmado' | 'realizado' | 'cancelado'
  /** Fora de uso desde 01/08/2026 (Camila só atende no espaço próprio agora) —
   * mantido pra compatibilidade com dado histórico de abr-jun/2026, sem UI. */
  local: 'quartinho' | 'karine'
  valor_cobrado: number
  observacoes?: string
  created_at: string
  cliente?: Cliente
  servico?: Servico
  forma_pagamento?: 'pix' | 'dinheiro' | 'cartao_debito' | 'cartao_credito' | 'transferencia' | null
  status_pagamento: 'pago' | 'parcial' | 'pendente'
  valor_pago?: number | null
  data_prevista_pagamento?: string | null
  /** Só usado com forma_pagamento = 'cartao_credito'. */
  parcelas?: number | null
  /** Só usado com forma_pagamento = 'cartao_credito' — no débito a taxa é sempre da Camila. */
  taxa_cartao_assumida_por?: 'cliente' | 'profissional' | null
}

export interface Lancamento {
  id: string
  tipo: 'entrada' | 'saida'
  descricao: string
  valor: number
  categoria: string
  data: string
  agendamento_id?: string
  created_at: string
}

export interface DashboardStats {
  faturamento_mes: number
  faturamento_mes_anterior: number
  total_clientes: number
  novos_clientes_mes: number
  agendamentos_mes: number
  ticket_medio: number
  despesas_mes: number
  lucro_mes: number
}
