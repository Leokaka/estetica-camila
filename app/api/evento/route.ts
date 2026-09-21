import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Grava os eventos da página pública (/agende) na tabela `eventos`.
//
// Por que passar por aqui em vez de gravar direto do navegador: a tabela não tem
// policy de INSERT, então a chave anônima — que é pública, vai no bundle do site —
// não consegue escrever. Só esta rota escreve, usando a service role no servidor.
// Se o número vai orientar quanto gastar em anúncio, ele não pode ser poluível
// por qualquer um que abra o código-fonte da página.

const TIPOS = ['visita', 'whatsapp', 'instagram', 'maps'] as const
type Tipo = (typeof TIPOS)[number]

// Origens conhecidas (as mesmas de app/agende/page.tsx) mais as dos anúncios.
// Qualquer coisa fora dessa lista vira NULL: sem isso, bastaria alguém chamar a
// rota com ?origem=<texto> pra inventar uma origem que nunca existiu no painel.
const ORIGENS = [
  'plasma', 'limpeza', 'cilios', 'corporal',
  'instagram', 'google', 'panfleto', 'cartao',
]

function textoCurto(valor: unknown, limite: number): string | null {
  if (typeof valor !== 'string') return null
  const limpo = valor.trim().slice(0, limite)
  return limpo.length > 0 ? limpo : null
}

export async function POST(request: Request) {
  // Valida antes de olhar credencial de propósito: assim o caminho de rejeição dá
  // pra testar em qualquer ambiente, inclusive na máquina do dev sem a service role.
  let corpo: Record<string, unknown>
  try {
    corpo = await request.json()
  } catch {
    return NextResponse.json({ ok: false, motivo: 'corpo-invalido' }, { status: 400 })
  }

  const tipo = corpo.tipo
  if (typeof tipo !== 'string' || !TIPOS.includes(tipo as Tipo)) {
    return NextResponse.json({ ok: false, motivo: 'tipo-invalido' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Sem a chave configurada a página tem que continuar funcionando normalmente —
  // medição quebrada nunca pode derrubar o caminho da cliente até o WhatsApp.
  if (!url || !chave) {
    return NextResponse.json({ ok: false, motivo: 'sem-credencial' }, { status: 200 })
  }

  const origemBruta = textoCurto(corpo.origem, 40)
  const origem = origemBruta && ORIGENS.includes(origemBruta) ? origemBruta : null

  // Guarda só o domínio de quem indicou, nunca a URL inteira: o caminho de uma
  // página de origem pode conter dado pessoal, e o domínio já responde a pergunta.
  let referencia: string | null = null
  const referrer = textoCurto(corpo.referencia, 300)
  if (referrer) {
    try {
      referencia = new URL(referrer).hostname.replace(/^www\./, '')
    } catch {
      referencia = null
    }
  }

  const supabase = createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error } = await supabase.from('eventos').insert({
    tipo,
    origem,
    referencia,
    caminho: textoCurto(corpo.caminho, 200),
    dispositivo: corpo.dispositivo === 'celular' ? 'celular' : 'computador',
    sessao: textoCurto(corpo.sessao, 40),
  })

  if (error) {
    // Não devolve erro pro navegador: a página da cliente não deve nem piscar por
    // causa disso. O log fica no Vercel pra gente ver se parou de gravar.
    console.error('[evento] falha ao gravar:', error.message)
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
