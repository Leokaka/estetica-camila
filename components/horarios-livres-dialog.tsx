'use client'

import { useState } from 'react'
import { isSameDay } from 'date-fns'
import { toast } from 'sonner'
import { Copy, Megaphone, Share2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { agendamentosParaOcupados } from '@/lib/agenda'
import { diasLivres, textoHorariosLivres } from '@/lib/horarios-livres'

type Ocupacao = { data_hora: string; servico?: { duracao_minutos?: number } | null }

/** Botão + diálogo de "Divulgar horários livres". Ver lib/horarios-livres.ts. */
export function HorariosLivres({ ocupacao }: { ocupacao: Ocupacao[] }) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')

  // O texto é gerado no toque de abrir e depois fica nas mãos dela: pode tirar um
  // horário que prefere guardar, mudar o tom, pôr um emoji. Gerar a cada render
  // apagaria o que ela editou.
  function abrir() {
    const dias = diasLivres(dia => agendamentosParaOcupados(ocupacao.filter(o => isSameDay(new Date(o.data_hora), dia))))
    setTexto(textoHorariosLivres(dias))
    setAberto(true)
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      toast.success('Copiado! Agora é só colar no status ou nos stories.')
    } catch {
      toast.error('Não consegui copiar — segura o dedo no texto e copia por lá.')
    }
  }

  async function compartilhar() {
    // No celular abre a folha de compartilhar do sistema — de lá dá pra mandar pro
    // WhatsApp (inclusive "Meu status") e pro Instagram. No computador, onde ela
    // não existe, cai pra copiar.
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ text: texto }) } catch { /* fechou a folha sem escolher: nada a fazer */ }
      return
    }
    copiar()
  }

  return (
    <>
      <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={abrir}>
        <Megaphone className="h-4 w-4 mr-2" /> Divulgar horários livres
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Divulgar horários livres</DialogTitle>
          </DialogHeader>
          {texto ? (
            <div className="space-y-3">
              <p className="text-sm text-brand-text-soft">
                Posta no status do WhatsApp e nos stories — quem vê já te conhece. Pode mexer no texto à vontade.
              </p>
              <Textarea value={texto} onChange={e => setTexto(e.target.value)} rows={12} className="text-sm" />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={copiar}>
                  <Copy className="h-4 w-4 mr-2" /> Copiar
                </Button>
                <Button type="button" className="flex-1" onClick={compartilhar}>
                  <Share2 className="h-4 w-4 mr-2" /> Compartilhar
                </Button>
              </div>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-brand-muted-soft">
              Semana cheia — nenhum horário livre pra divulgar nos próximos 7 dias. 🎉
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
