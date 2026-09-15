import Image from 'next/image'
import type { Metadata } from 'next'
import { ENDERECO } from '@/lib/whatsapp'

// Página pública (link da bio do Instagram + campo "site" do Perfil do Google).
// Existe porque o funil dela era sem saída: quem achava a Camila no Google ou no
// Instagram não tinha caminho direto pro WhatsApp. Tudo aqui empurra pra UMA ação:
// abrir conversa no WhatsApp com mensagem já escrita.

const WHATSAPP = '5511911143719'
const INSTAGRAM = 'https://www.instagram.com/camila_garcia.esteticista/'
const MAPS = 'https://www.google.com/maps/search/Camila+Garcia+Est%C3%A9tica+Rua+S%C3%A3o+Teodoro+833'

function whatsappLink(texto: string) {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`
}

export const metadata: Metadata = {
  title: 'Camila Garcia Estética | Esteticista em Vila Carmosina, São Paulo',
  description:
    'Esteticista na Vila Carmosina, zona leste de São Paulo. Jato de plasma, limpeza de pele, microagulhamento, peeling, drenagem linfática, extensão de cílios e sobrancelhas. Atendimento com hora marcada.',
  openGraph: {
    title: 'Camila Garcia Estética',
    description: 'Esteticista em Vila Carmosina, São Paulo. Agende pelo WhatsApp.',
    type: 'website',
  },
}

// Avaliações reais publicadas no Perfil do Google (nota 5,0, 25 avaliações).
// Estão aqui porque a página só dizia "5,0" — número sozinho não convence tanto
// quanto alguém contando o que sentiu. Nome abreviado no sobrenome de propósito.
const DEPOIMENTOS = [
  { texto: 'Que profissional e espaço incrível, tudo muito acolhedor.', autora: 'Eliana S.' },
  { texto: 'Amei o atendimento, super atenciosa e tirou minhas dúvidas sobre o procedimento.', autora: 'Laís B.' },
  { texto: 'Super recomendo, ambiente agradável!', autora: 'Ana Caroline A.' },
]

const GRUPOS = [
  {
    titulo: 'Estética facial e corporal',
    itens: [
      { nome: 'Jato de plasma (verruga, dermatose papulosa negra)', preco: 'a partir de R$ 150' },
      { nome: 'Limpeza de pele', preco: 'R$ 120' },
      { nome: 'Peeling', preco: 'R$ 130' },
      { nome: 'Microagulhamento', preco: 'R$ 100' },
      { nome: 'Drenagem linfática', preco: 'R$ 85' },
      { nome: 'Massagem modeladora', preco: 'R$ 90' },
      { nome: 'Massagem relaxante', preco: 'R$ 90' },
    ],
  },
  {
    titulo: 'Cílios e sobrancelhas',
    itens: [
      { nome: 'Volume brasileiro', preco: 'R$ 140' },
      { nome: 'Volume egípcio', preco: 'R$ 150' },
      { nome: 'Fox eyes', preco: 'R$ 160' },
      { nome: 'Lash lifting', preco: 'R$ 130' },
      { nome: 'Brow lamination', preco: 'R$ 100' },
    ],
  },
]

export default function AgendePage() {
  return (
    <main className="min-h-screen bg-brand-bg px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        {/* Identidade */}
        <header className="flex flex-col items-center text-center">
          <Image src="/logo/selo-cg.png" alt="Camila Garcia Estética" width={104} height={104} priority />
          <h1
            className="mt-4 text-2xl tracking-[0.08em] text-brand-dark"
            style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 600 }}
          >
            CAMILA GARCIA
          </h1>
          <p className="mt-1 text-[11px] font-medium tracking-[0.4em] text-brand-gold">ESTÉTICA</p>
          <p className="mt-3 text-sm text-brand-text-soft">
            Esteticista · Vila Carmosina, São Paulo
          </p>
          <p className="mt-2 text-xs text-brand-muted">
            ★★★★★ 5,0 no Google · atendimento com hora marcada
          </p>
        </header>

        {/* Ação principal: conversa no WhatsApp já começada */}
        <a
          href={whatsappLink('Oi, Camila! Vim pelo seu perfil e queria saber sobre um procedimento 😊')}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-medium px-6 py-4 text-base font-semibold text-white shadow-lg transition-colors hover:bg-brand-medium-hover"
        >
          Falar no WhatsApp
        </a>
        <p className="mt-2 text-center text-xs text-brand-muted">
          Respondo por aqui e já deixo seu horário marcado
        </p>

        {/* Instagram e rota logo abaixo do WhatsApp, não no rodapé: a Camila reparou que
            quem vinha da bio tinha que rolar a página inteira pra achar o Instagram —
            numa página de link de bio, os links são o conteúdo, não o rodapé. */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <a
            href={INSTAGRAM}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-2xl border border-brand-border bg-brand-card px-4 py-3 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-surface-warm"
          >
            Instagram
          </a>
          <a
            href={MAPS}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-2xl border border-brand-border bg-brand-card px-4 py-3 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-surface-warm"
          >
            Como chegar
          </a>
        </div>

        {/* Prova social antes dos preços: quem chega pelo Google não conhece a Camila,
            e ler outra cliente falando pesa mais na decisão do que a tabela de valores. */}
        <section className="mt-9">
          <h2 className="text-center text-xs font-semibold tracking-[0.2em] text-brand-muted uppercase">
            O que dizem as clientes
          </h2>
          <div className="mt-4 space-y-3">
            {DEPOIMENTOS.map(dep => (
              <figure
                key={dep.autora}
                className="rounded-2xl border border-brand-border bg-brand-card p-4"
              >
                <blockquote className="text-sm leading-relaxed text-brand-text-soft">
                  “{dep.texto}”
                </blockquote>
                <figcaption className="mt-2 text-xs text-brand-muted">
                  {dep.autora} · avaliação no Google
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-brand-muted">
            25 avaliações no Google, todas 5 estrelas
          </p>
        </section>

        {/* Serviços — ordem reflete o posicionamento de esteticista, não de salão */}
        <section className="mt-9">
          <h2 className="text-center text-xs font-semibold tracking-[0.2em] text-brand-muted uppercase">
            Procedimentos
          </h2>
          <div className="mt-4 space-y-4">
            {GRUPOS.map(grupo => (
              <div key={grupo.titulo} className="rounded-2xl border border-brand-border bg-brand-card p-4">
                <h3 className="text-sm font-semibold text-brand-dark">{grupo.titulo}</h3>
                <ul className="mt-3 space-y-2">
                  {grupo.itens.map(item => (
                    <li key={item.nome} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-brand-text-soft">{item.nome}</span>
                      <span className="shrink-0 font-medium text-brand-dark">{item.preco}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <a
            href={whatsappLink('Oi, Camila! Queria agendar um horário 😊')}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center rounded-2xl border border-brand-medium px-6 py-3 text-sm font-semibold text-brand-medium transition-colors hover:bg-brand-surface-warm"
          >
            Agendar meu horário
          </a>
        </section>

        {/* Onde fica */}
        <section className="mt-9 rounded-2xl border border-brand-border bg-brand-card p-4 text-center">
          <h2 className="text-xs font-semibold tracking-[0.2em] text-brand-muted uppercase">Onde fica</h2>
          <p className="mt-3 text-sm text-brand-text-soft">{ENDERECO}</p>
          <a
            href={MAPS}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center justify-center rounded-xl border border-brand-border px-4 py-2 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-surface"
          >
            Como chegar
          </a>
        </section>

        {/* Outros canais */}
        <section className="mt-6 space-y-2">
          <a
            href={INSTAGRAM}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center rounded-2xl border border-brand-border bg-brand-card px-6 py-3 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-surface"
          >
            Ver meu Instagram
          </a>
          <a
            href={MAPS}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center rounded-2xl border border-brand-border bg-brand-card px-6 py-3 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-surface"
          >
            Avaliar no Google
          </a>
        </section>

        <footer className="mt-10 pb-4 text-center text-[11px] text-brand-muted-soft">
          Camila Garcia Estética · {ENDERECO}
        </footer>
      </div>
    </main>
  )
}
