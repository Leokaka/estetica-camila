// Atualiza a tabela `servicos` com os preços/categorias atuais (jul/2026, sem Karine).
// Uso: node scripts/update-servicos.mjs
// Requer SUPABASE_SERVICE_ROLE_KEY no .env.local (bypassa RLS) OU rodar logado.

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split(/\r?\n/).filter(Boolean)
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)

const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, KEY)

const SERVICOS = [
  // Cílios & Sobrancelhas
  { nome: 'Volume Brasileiro', preco: 140, custo: 30, duracao_minutos: 120, categoria: 'Cílios' },
  { nome: 'Volume Egípcio', preco: 150, custo: 32, duracao_minutos: 130, categoria: 'Cílios' },
  { nome: 'Fox Eyes', preco: 160, custo: 34, duracao_minutos: 130, categoria: 'Cílios' },
  { nome: 'Lash Lifting', preco: 130, custo: 25, duracao_minutos: 60, categoria: 'Cílios' },
  { nome: 'Brow Lamination', preco: 100, custo: 20, duracao_minutos: 45, categoria: 'Sobrancelha' },
  // Pele
  { nome: 'Limpeza de Pele', preco: 120, custo: 25, duracao_minutos: 75, categoria: 'Facial' },
  { nome: 'Microagulhamento', preco: 100, custo: 23, duracao_minutos: 40, categoria: 'Facial' },
  { nome: 'Peeling', preco: 130, custo: 28, duracao_minutos: 45, categoria: 'Facial' },
  // Corpo & Massagens
  { nome: 'Massagem Modeladora', preco: 90, custo: 15, duracao_minutos: 60, categoria: 'Corporal' },
  { nome: 'Drenagem Linfática', preco: 85, custo: 12, duracao_minutos: 60, categoria: 'Corporal' },
  { nome: 'Massagem Relaxante', preco: 90, custo: 15, duracao_minutos: 60, categoria: 'Corporal' },
]

const run = async () => {
  console.log(`Usando ${KEY === env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role (bypassa RLS)' : 'anon key (precisa estar logado/RLS liberado)'}`)

  const { data: existentes, error: eErr } = await supabase.from('servicos').select('id, nome')
  if (eErr) { console.error('Erro ao ler servicos:', eErr.message); process.exit(1) }
  console.log(`${existentes.length} serviços já cadastrados no banco.`)

  // Desativa (não apaga — preserva histórico de agendamentos antigos) tudo que não está na lista nova
  const nomesNovos = new Set(SERVICOS.map(s => s.nome.toLowerCase()))
  const paraDesativar = existentes.filter(e => !nomesNovos.has(e.nome.toLowerCase()))
  if (paraDesativar.length) {
    const { error } = await supabase.from('servicos').update({ ativo: false }).in('id', paraDesativar.map(s => s.id))
    if (error) console.error('Erro ao desativar antigos:', error.message)
    else console.log(`Desativados (fora de linha, histórico preservado): ${paraDesativar.map(s => s.nome).join(', ')}`)
  }

  for (const s of SERVICOS) {
    const existente = existentes.find(e => e.nome.toLowerCase() === s.nome.toLowerCase())
    if (existente) {
      const { error } = await supabase.from('servicos').update({ ...s, ativo: true }).eq('id', existente.id)
      if (error) console.error(`Erro ao atualizar ${s.nome}:`, error.message)
      else console.log(`Atualizado: ${s.nome} — R$ ${s.preco}`)
    } else {
      const { error } = await supabase.from('servicos').insert({ ...s, ativo: true })
      if (error) console.error(`Erro ao inserir ${s.nome}:`, error.message)
      else console.log(`Criado: ${s.nome} — R$ ${s.preco}`)
    }
  }
  console.log('Concluído.')
}

run()
