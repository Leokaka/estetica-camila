import type { SupabaseClient } from '@supabase/supabase-js'

// Como a cliente chegou. Ver supabase-origem-clientes.sql pro porquê.
export const ORIGENS = [
  { valor: 'indicacao', label: 'Indicação' },
  { valor: 'instagram', label: 'Instagram' },
  { valor: 'google', label: 'Google' },
  { valor: 'passou_na_frente', label: 'Passou na frente' },
  { valor: 'outro', label: 'Outro' },
] as const

export type Origem = (typeof ORIGENS)[number]['valor']

export function rotuloOrigem(valor: string | null | undefined) {
  return ORIGENS.find(o => o.valor === valor)?.label ?? null
}

type DadosCliente = Record<string, unknown> & { origem?: string | null; indicada_por?: string | null }

/**
 * Grava cliente (insere, ou atualiza quando vem `id`) e devolve a linha.
 *
 * `origem`/`indicada_por` são colunas novas (supabase-origem-clientes.sql). Enquanto
 * o SQL não roda, mandar esses campos faria o cadastro inteiro falhar — e cadastrar
 * cliente é o meio do agendamento. Então, nesse erro específico, tenta de novo sem
 * eles: perder a origem é melhor do que perder a cliente.
 */
export async function gravarCliente(supabase: SupabaseClient, dados: DadosCliente, id?: string) {
  const enviar = (payload: DadosCliente) => id
    ? supabase.from('clientes').update(payload).eq('id', id).select().single()
    : supabase.from('clientes').insert(payload).select().single()

  const resultado = await enviar(dados)
  if (resultado.error && /origem|indicada_por/.test(resultado.error.message)) {
    const { origem: _o, indicada_por: _i, ...semOrigem } = dados
    void _o; void _i
    return enviar(semOrigem)
  }
  return resultado
}
