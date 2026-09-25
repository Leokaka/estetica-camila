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

const CHAVE_NAO_CONTAR = 'cg-nao-contar'

/**
 * Deixa o Léo e a Camila abrirem a página sem sujar o número.
 *
 * Existe porque com o volume atual (9 visitas na semana) duas conferidas deles já
 * distorcem o resultado, e não havia jeito de separar: a medição é anônima de
 * propósito, então "quem foi" não dá pra saber depois. A saída é marcar o próprio
 * aparelho ANTES — abrir uma vez `/agende?naocontar=1` e aquele navegador para de
 * contar pra sempre. `?naocontar=0` desfaz.
 */
function naoContarEsteAparelho(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    const marca = params.get('naocontar')
    if (marca === '1') {
      localStorage.setItem(CHAVE_NAO_CONTAR, '1')
      return true
    }
    if (marca === '0') {
      localStorage.removeItem(CHAVE_NAO_CONTAR)
      return false
    }
    return localStorage.getItem(CHAVE_NAO_CONTAR) === '1'
  } catch {
    // Navegador anônimo ou storage bloqueado: na dúvida, conta. Perder uma visita
    // real é pior do que contar uma conferida a mais.
    return false
  }
}

export function Rastreio({ origem }: { origem?: string }) {
  // StrictMode roda o efeito duas vezes em desenvolvimento; sem essa trava cada
  // visita entraria dobrada no banco.
  const jaContou = useRef(false)

  useEffect(() => {
    // Checado uma vez, no início: se este aparelho está marcado como "não contar",
    // nenhum evento sai daqui — nem a visita, nem os cliques.
    const ignorar = naoContarEsteAparelho()

    function registrar(tipo: Tipo) {
      if (ignorar) return
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
