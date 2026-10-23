'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, RotateCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { AgendamentoBruto, ClienteBruto, EventoBruto, ServicoBruto } from './_painel/calculos'
import { BarraPeriodo, Painel, type Brutos } from './_painel/painel'
import { Esqueleto } from './_painel/ui'

// Painel de marketing E de negócio: do clique na página até o dinheiro no caixa.
// Antes era só "visitas e conversas por dia" — não ligava o marketing a cliente
// nem a faturamento, e o gráfico de barras diário com 2 ou 3 eventos por dia era
// ruído. Agora: o mês acumulado com projeção, o funil, a tendência semanal e o que
// vende. Todo o cálculo está em _painel/calculos.ts (funções puras); esta página
// só busca as linhas e cuida de carregando/erro.

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'ok'; brutos: Brutos; agora: Date }

const PAGINA = 1000

/** O Supabase devolve no máximo 1000 linhas por consulta; os eventos passam disso com o tempo. */
async function buscarTodas<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const todas: T[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1)
    if (error) throw new Error(error.message)
    todas.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGINA) break
  }
  return todas
}

async function carregar(): Promise<Brutos> {
  const supabase = createClient()
  // Quatro consultas em paralelo, só as colunas usadas. O volume é pequeno (centenas
  // de linhas): agregar no navegador é mais simples que manter views no banco.
  const [eventos, agendamentos, clientes, servicos] = await Promise.all([
    buscarTodas<EventoBruto>((de, ate) => supabase.from('eventos')
      .select('id, criado_em, tipo, origem, sessao').order('id').range(de, ate)),
    buscarTodas<AgendamentoBruto>((de, ate) => supabase.from('agendamentos')
      .select('id, cliente_id, servico_id, data_hora, status, valor_cobrado').order('id').range(de, ate)),
    buscarTodas<ClienteBruto>((de, ate) => supabase.from('clientes')
      .select('id, nome, telefone, created_at, origem, contato_retorno_em').order('id').range(de, ate)),
    buscarTodas<ServicoBruto>((de, ate) => supabase.from('servicos')
      .select('id, nome, categoria, preco, custo, dias_retorno').order('id').range(de, ate)),
  ])
  return { eventos, agendamentos, clientes, servicos }
}

export default function MarketingPage() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let cancelado = false
    carregar()
      .then(brutos => { if (!cancelado) setEstado({ tipo: 'ok', brutos, agora: new Date() }) })
      .catch((e: unknown) => {
        if (!cancelado) setEstado({ tipo: 'erro', mensagem: e instanceof Error ? e.message : String(e) })
      })
    return () => { cancelado = true }
  }, [tentativa])

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-wide text-brand-dark">Marketing</h1>
        <p className="mt-1 text-sm text-brand-text-soft">
          Do clique na página ao dinheiro no caixa: quem chegou, quem virou cliente e o que mais vende.
        </p>
      </div>

      {estado.tipo === 'carregando' && <EsqueletoPainel />}

      {estado.tipo === 'erro' && (
        <Card className="border-danger/30 bg-danger-soft">
          <CardContent className="flex flex-col items-start gap-3">
            <p className="flex items-center gap-2 font-medium text-danger">
              <AlertCircle className="h-4 w-4" /> Não consegui carregar os números agora
            </p>
            <p className="text-sm text-brand-text-soft">
              Pode ser a internet oscilando. Nada foi perdido — é só tentar de novo.
            </p>
            <Button size="sm" variant="outline" onClick={() => { setEstado({ tipo: 'carregando' }); setTentativa(t => t + 1) }}>
              <RotateCw className="h-3.5 w-3.5" /> Tentar de novo
            </Button>
            <p className="text-[11px] text-brand-muted-soft">Detalhe técnico: {estado.mensagem}</p>
          </CardContent>
        </Card>
      )}

      {estado.tipo === 'ok' && <Painel brutos={estado.brutos} agora={estado.agora} />}
    </div>
  )
}

function EsqueletoPainel() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Carregando o painel">
      <BarraPeriodo valor="mes" onChange={() => {}} />
      <Esqueleto className="h-20 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <Esqueleto key={i} className="h-32 rounded-2xl" />)}
      </div>
      <Esqueleto className="h-80 w-full rounded-2xl" />
      <Esqueleto className="h-64 w-full rounded-2xl" />
    </div>
  )
}
