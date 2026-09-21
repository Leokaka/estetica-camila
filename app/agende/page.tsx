import Image from 'next/image'
import type { Metadata } from 'next'
import { ENDERECO } from '@/lib/whatsapp'
import { Rastreio } from './rastreio'

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

// Rastreio de origem sem analytics, cookie ou pixel: cada anúncio aponta pra
// /agende?origem=<chave>, e a chave troca a mensagem que já vai escrita no WhatsApp.
// Assim a própria conversa diz de onde a pessoa veio — a Camila lê no celular dela,
// sem depender de painel nenhum, e a gente descobre qual anúncio traz cliente de
// verdade em vez de só trazer clique.
const ORIGENS: Record<string, { entrada: string; agendar: string }> = {
  plasma: {
    entrada: 'Oi, Camila! Vi seu anúncio sobre remoção de verruga com jato de plasma e queria saber mais 😊',
    agendar: 'Oi, Camila! Queria saber o valor e agendar uma avaliação pra remoção de verruga (jato de plasma) 😊',
  },
  limpeza: {
    entrada: 'Oi, Camila! Vi seu anúncio sobre limpeza de pele e queria saber mais 😊',
    agendar: 'Oi, Camila! Queria saber o valor da limpeza de pele e agendar um horário 😊',
  },
  cilios: {
    entrada: 'Oi, Camila! Vi seu anúncio sobre extensão de cílios e queria saber mais 😊',
    agendar: 'Oi, Camila! Queria saber o valor da extensão de cílios e agendar um horário 😊',
  },
  corporal: {
    entrada: 'Oi, Camila! Vi seu anúncio sobre drenagem/massagem modeladora e queria saber mais 😊',
    agendar: 'Oi, Camila! Queria saber o valor da drenagem/massagem modeladora e agendar um horário 😊',
  },
  instagram: {
    entrada: 'Oi, Camila! Vim pelo seu Instagram e queria saber sobre um procedimento 😊',
    agendar: 'Oi, Camila! Vim pelo seu Instagram e queria saber o valor de um procedimento e agendar 😊',
  },
  // O botão "Site" do Perfil do Google aponta pra cá com ?origem=google. É o único
  // caminho do Google que aparece em toda superfície (busca e Maps, celular e
  // computador) — o botão de WhatsApp do perfil só renderiza no app do Maps e não
  // aceita mensagem pré-escrita, então a atribuição de lá é sempre cega.
  google: {
    entrada: 'Oi, Camila! Encontrei você no Google e queria saber sobre um procedimento 😊',
    agendar: 'Oi, Camila! Encontrei você no Google e queria saber o valor de um procedimento e agendar 😊',
  },
}

const ORIGEM_PADRAO = {
  entrada: 'Oi, Camila! Vim pelo seu perfil e queria saber sobre um procedimento 😊',
  agendar: 'Oi, Camila! Queria saber o valor de um procedimento e agendar um horário 😊',
}

// Ícones inline em vez de biblioteca: são três, a página é pública e o que menos
// se quer aqui é JavaScript extra atrasando o primeiro toque de quem veio de anúncio.
function IconeWhatsApp({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.13h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24z" />
    </svg>
  )
}

function IconeInstagram({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconeRota({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M20 10.5c0 5.2-6.3 10.3-7.5 11.2a.8.8 0 0 1-1 0C10.3 20.8 4 15.7 4 10.5a8 8 0 1 1 16 0z" />
      <circle cx="12" cy="10.3" r="2.8" />
    </svg>
  )
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

// Sem preço, por decisão da Camila (set/2026): o valor na vitrine responde a dúvida
// da pessoa e ela vai embora sem nunca abrir conversa — e cada reajuste obrigaria a
// mexer em três lugares. No lugar do número entra o que o procedimento resolve: é o
// que faz a pessoa se reconhecer no problema, e ainda dá ao Google texto de verdade
// pra casar com buscas como "limpeza de pele vila carmosina".
const GRUPOS = [
  {
    titulo: 'Estética facial e corporal',
    itens: [
      { nome: 'Jato de plasma', descricao: 'Remoção de verruga e dermatose papulosa negra, sem corte e sem ponto' },
      { nome: 'Limpeza de pele', descricao: 'Cravo, oleosidade e textura — a pele já sai diferente no mesmo dia' },
      { nome: 'Peeling', descricao: 'Renova a pele e clareia manchas e marcas de acne' },
      { nome: 'Microagulhamento', descricao: 'Estimula colágeno e trata textura, marcas de acne e estrias' },
      { nome: 'Drenagem linfática', descricao: 'Desincha, ativa a circulação e tira o peso das pernas' },
      { nome: 'Massagem modeladora', descricao: 'Modela o corpo com placas de contração abdominal' },
      { nome: 'Massagem relaxante', descricao: 'Uma hora só sua, pra soltar a tensão acumulada' },
    ],
  },
  {
    titulo: 'Cílios e sobrancelhas',
    itens: [
      { nome: 'Volume brasileiro', descricao: 'Volume natural, que não pesa no olhar' },
      { nome: 'Volume egípcio', descricao: 'Mais marcado, com o olhar preenchido' },
      { nome: 'Fox eyes', descricao: 'Efeito de olhar puxadinho, alongado no canto externo' },
      { nome: 'Lash lifting', descricao: 'Curva o seu próprio cílio, sem alongamento' },
      { nome: 'Brow lamination', descricao: 'Alinha os fios e deixa a sobrancelha preenchida' },
    ],
  },
]

export default async function AgendePage({
  searchParams,
}: {
  searchParams: Promise<{ origem?: string }>
}) {
  const { origem } = await searchParams
  const msg = (origem && ORIGENS[origem]) || ORIGEM_PADRAO

  return (
    <main className="min-h-screen bg-brand-bg px-5 py-10">
      <Rastreio origem={origem} />
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
          href={whatsappLink(msg.entrada)}
          target="_blank"
          rel="noopener noreferrer"
          data-evento="whatsapp"
          className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand-medium px-6 py-4 text-base font-semibold text-white shadow-lg transition-colors hover:bg-brand-medium-hover"
        >
          <IconeWhatsApp className="h-5 w-5 shrink-0" />
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
            data-evento="instagram"
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-brand-border bg-brand-card px-4 py-4 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-surface-warm"
          >
            <IconeInstagram className="h-6 w-6 text-brand-terra" />
            Instagram
          </a>
          <a
            href={MAPS}
            target="_blank"
            rel="noopener noreferrer"
            data-evento="maps"
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-brand-border bg-brand-card px-4 py-4 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-surface-warm"
          >
            <IconeRota className="h-6 w-6 text-brand-terra" />
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
          {/* A ausência do preço precisa ser explicada na hora, senão lê como preço
              escondido — e preço escondido lê como caro. Dizer que ela passa no
              WhatsApp transforma a lacuna no próprio motivo de chamar. */}
          <p className="mt-2 text-center text-xs leading-relaxed text-brand-muted">
            Os valores eu passo no WhatsApp, de acordo com o que você precisa
          </p>
          <div className="mt-4 space-y-4">
            {GRUPOS.map(grupo => (
              <div key={grupo.titulo} className="rounded-2xl border border-brand-border bg-brand-card p-4">
                <h3 className="text-sm font-semibold text-brand-dark">{grupo.titulo}</h3>
                <ul className="mt-3 space-y-3">
                  {grupo.itens.map(item => (
                    <li
                      key={item.nome}
                      className="border-b border-brand-border/60 pb-3 last:border-0 last:pb-0"
                    >
                      <p className="text-sm font-medium text-brand-dark">{item.nome}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-brand-muted">
                        {item.descricao}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <a
            href={whatsappLink(msg.agendar)}
            target="_blank"
            rel="noopener noreferrer"
            data-evento="whatsapp"
            className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-brand-medium px-6 py-3 text-sm font-semibold text-brand-medium transition-colors hover:bg-brand-surface-warm"
          >
            <IconeWhatsApp className="h-4 w-4 shrink-0" />
            Ver valores e agendar
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
            data-evento="maps"
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
            data-evento="instagram"
            className="flex w-full items-center justify-center rounded-2xl border border-brand-border bg-brand-card px-6 py-3 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-surface"
          >
            Ver meu Instagram
          </a>
          <a
            href={MAPS}
            target="_blank"
            rel="noopener noreferrer"
            data-evento="maps"
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
