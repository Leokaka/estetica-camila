'use client'

import { useEffect, useRef } from 'react'

// Medição da página pública. Registra a visita e os cliques nos botões que levam
// a cliente pra fora (WhatsApp, Instagram, rota no Maps).
//
// Nada aqui pode atrapalhar a cliente: todo envio é disparado e esquecido, com
// erro engolido. Se a medição cair, a página continua funcionando igual.

type Tipo = 'visita' | 'whatsapp' | 'instagram' | 'maps'

// Identifica a aba, não a pessoa: sorteado na hora, guardado só em sessionStorage
// e perdido ao fechar. Serve pra saber que a visita e o clique vieram da mesma
// pessoa — sem isso não dá pra calcular taxa de conversão, só somar números soltos.
function pegarSessao(): string | null {
  try {
    const guardada = sessionStorage.getItem('cg-sessao')
    if (guardada) return guardada
    const nova = Math.random().toString(36).slice(2, 12)
    sessionStorage.setItem('cg-sessao', nova)
    return nova
  } catch {
    return null
  }
}

export function Rastreio({ origem }: { origem?: string }) {
  // StrictMode roda o efeito duas vezes em desenvolvimento; sem essa trava cada
  // visita entraria dobrada no banco.
  const jaContou = useRef(false)

  useEffect(() => {
    function registrar(tipo: Tipo) {
      const corpo = JSON.stringify({
        tipo,
        origem: origem ?? null,
        caminho: window.location.pathname,
        referencia: document.referrer || null,
        dispositivo: window.matchMedia('(max-width: 768px)').matches ? 'celular' : 'computador',
        sessao: pegarSessao(),
      })

      // keepalive porque o clique no WhatsApp pode tirar o navegador da frente no
      // celular: sem isso o envio é cancelado no meio e o clique some da conta.
      fetch('/api/evento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: corpo,
        keepalive: true,
      }).catch(() => {})
    }

    if (!jaContou.current) {
      jaContou.current = true
      registrar('visita')
    }

    // Um ouvinte só, delegado, em vez de um por botão: a página é server component
    // e os links são <a> comuns — assim nenhum deles precisa virar client component.
    function aoClicar(evento: MouseEvent) {
      const alvo = (evento.target as HTMLElement | null)?.closest('[data-evento]')
      if (!alvo) return
      const tipo = alvo.getAttribute('data-evento')
      if (tipo === 'whatsapp' || tipo === 'instagram' || tipo === 'maps') {
        registrar(tipo)
      }
    }

    document.addEventListener('click', aoClicar)
    return () => document.removeEventListener('click', aoClicar)
  }, [origem])

  return null
}
