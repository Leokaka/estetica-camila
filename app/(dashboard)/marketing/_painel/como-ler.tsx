import type { ReactNode } from 'react'
import { BookOpen, ChevronDown } from 'lucide-react'

// Tudo que antes ficava espalhado em rodapés. Fechado por padrão: quem já sabe
// não precisa rolar por cima; quem estranhar um número sabe onde olhar.
export function ComoLer() {
  return (
    <details className="group rounded-2xl border border-brand-border bg-brand-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-heading text-base font-medium text-brand-dark">
          <BookOpen className="h-4 w-4 text-brand-muted" /> Como ler este painel
        </span>
        <ChevronDown className="h-4 w-4 text-brand-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 px-4 pb-4 text-sm leading-relaxed text-brand-text-soft">
        <Bloco titulo="De onde vem cada número">
          <p>
            <strong>Visitas, conversas e origens</strong> vêm da página de agendamento (/agende), que
            começou a contar em 22/09/2026. Antes disso não existe esse dado — por isso comparações com
            períodos anteriores a essa data não aparecem.
          </p>
          <p>
            <strong>Atendimentos, faturamento, ticket e clientes</strong> vêm da agenda e valem desde o
            começo do sistema (maio/2026). “Atendimento feito” é todo horário que já passou e não foi
            cancelado — mesmo que tenha ficado como “agendado”, porque quase nunca dá tempo de marcar
            “realizado”. Se alguém faltou, cancele o horário e ele sai da conta.
          </p>
          <p>
            <strong>Cliente nova</strong> conta pela data em que ela chegou: o cadastro ou o primeiro
            horário, o que veio antes (algumas clientes foram cadastradas depois de já terem sido atendidas).
          </p>
          <p>
            <strong>Projeção</strong> é só o ritmo do mês até hoje esticado até o último dia. Não sabe de
            feriado nem de agenda cheia; serve pra ver a direção, não pra prometer número.
          </p>
        </Bloco>

        <Bloco titulo="Visitas × pessoas">
          <p>
            Uma pessoa que abre a página três vezes vira 3 visitas, mas 1 pessoa. Com o volume de hoje
            essa diferença pesa, então o número de pessoas diferentes aparece junto.
          </p>
        </Bloco>

        <Bloco titulo="Links com ?origem=">
          <p>
            Todo link publicado precisa terminar com <code>?origem=</code> — <code>instagram</code> na
            bio, <code>google</code> no perfil, o nome do anúncio em cada anúncio. Sem isso a visita
            existe, mas cai em “Direto ou link sem marcação”, junto com quem digitou o endereço ou salvou
            nos favoritos.
          </p>
        </Bloco>

        <Bloco titulo="Suas próprias conferidas">
          <p>
            Para seus acessos não entrarem na conta, abra uma vez <code>/agende?naocontar=1</code> em
            cada celular seu. Aquele aparelho para de contar para sempre (<code>?naocontar=0</code> desfaz).
          </p>
        </Bloco>

        <Bloco titulo="O que este painel não enxerga">
          <p>
            <strong>Se a mensagem foi realmente enviada.</strong> O clique no botão é o último passo
            dentro da página; depois disso o WhatsApp assume. “Conversa” quer dizer que a pessoa chegou
            na tela de conversa com o texto já escrito — quem confirma o envio é a caixa de entrada.
          </p>
          <p>
            <strong>O movimento do Perfil do Google.</strong> Quantas pessoas viram o perfil, pediram
            rota ou ligaram só aparece no painel de Desempenho do próprio Google. Aqui entra só quem
            clicou no site e caiu nesta página.
          </p>
          <p>
            <strong>Quem clicou é quem virou cliente?</strong> Não dá pra saber pessoa a pessoa. O funil
            compara os totais do mesmo período — é uma aproximação.
          </p>
        </Bloco>
      </div>
    </details>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-muted">{titulo}</h3>
      {children}
    </section>
  )
}
