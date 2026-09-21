'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, MessageCircle, Eye, ExternalLink, MapPin } from 'lucide-react'

// Painel de marketing: o que acontece ANTES da cliente virar agendamento.
// O resto do sistema só enxerga quem já virou cliente; aqui a gente vê quanta
// gente chegou na página, de onde veio e quantas de fato abriram conversa.

type Evento = {
  criado_em: string
  tipo: 'visita' | 'whatsapp' | 'instagram' | 'maps'
  origem: string | null
  dispositivo: string | null
}

const PERIODOS = [
  { dias: 7, label: '7 dias' },
  { dias: 30, label: '30 dias' },
  { dias: 90, label: '90 dias' },
]

// Nome bonito de cada origem. A chave é o ?origem= que vai no link publicado —
// é isso que liga cada visita ao lugar onde o link foi colado.
const NOME_ORIGEM: Record<string, string> = {
  instagram: 'Instagram',
  google: 'Google (perfil)',
  plasma: 'Anúncio · jato de plasma',
  limpeza: 'Anúncio · limpeza de pele',
  cilios: 'Anúncio · cílios',
  corporal: 'Anúncio · drenagem e massagem',
  panfleto: 'Panfleto (QR)',
  cartao: 'Cartão de visita',
}
const ORIGEM_SEM_MARCA = 'Direto ou link sem marcação'

function inicioDoDia(data: Date) {
  const d = new Date(data)
  d.setHours(0, 0, 0, 0)
  return d
}

function chaveDia(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function rotuloDia(data: Date) {
  return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`
}

/** Variação percentual entre dois períodos iguais. Devolve null quando não dá pra comparar. */
function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return Math.round(((atual - anterior) / anterior) * 100)
}

function Delta({ atual, anterior }: { atual: number; anterior: number }) {
  const v = variacao(atual, anterior)

  if (v === null) {
    return (
      <p className="mt-1 text-xs text-brand-muted">
        {atual > 0 ? 'primeiro período com movimento' : 'sem dados no período anterior'}
      </p>
    )
  }
  if (v === 0) {
    return (
      <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-brand-muted">
        <Minus className="h-3 w-3 shrink-0" /> igual ao período anterior
      </p>
    )
  }
  const subiu = v > 0
  const Icone = subiu ? TrendingUp : TrendingDown
  // flex-wrap porque em duas colunas no celular o texto não cabe numa linha só —
  // sem isso ele vaza pra fora do cartão em vez de quebrar.
  return (
    <p className={`mt-1 flex flex-wrap items-center gap-x-1 text-xs ${subiu ? 'text-emerald-600' : 'text-rose-600'}`}>
      <Icone className="h-3 w-3 shrink-0" />
      <span>{subiu ? '+' : ''}{v}% vs. anterior ({anterior})</span>
    </p>
  )
}

export default function MarketingPage() {
  const [dias, setDias] = useState(30)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [semTabela, setSemTabela] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setCarregando(true)
      // Busca o dobro do período pra conseguir comparar com o período anterior
      // na mesma consulta — sem isso não dá pra responder "está melhorando?".
      const desde = inicioDoDia(new Date())
      desde.setDate(desde.getDate() - dias * 2 + 1)

      const { data, error } = await supabase
        .from('eventos')
        .select('criado_em, tipo, origem, dispositivo')
        .gte('criado_em', desde.toISOString())
        .order('criado_em', { ascending: true })

      if (cancelado) return

      if (error) {
        // A tabela ainda não existe se o SQL não foi rodado — mostra o que fazer
        // em vez de uma tela quebrada.
        setSemTabela(error.message.includes('does not exist') || error.code === '42P01')
        setEventos([])
      } else {
        setSemTabela(false)
        setEventos((data as Evento[]) ?? [])
      }
      setCarregando(false)
    }

    carregar()
    return () => { cancelado = true }
  }, [supabase, dias])

  const dados = useMemo(() => {
    const hoje = inicioDoDia(new Date())
    const inicioAtual = new Date(hoje)
    inicioAtual.setDate(inicioAtual.getDate() - dias + 1)

    const atuais: Evento[] = []
    const anteriores: Evento[] = []
    for (const e of eventos) {
      if (new Date(e.criado_em) >= inicioAtual) atuais.push(e)
      else anteriores.push(e)
    }

    const contar = (lista: Evento[], tipo: Evento['tipo']) =>
      lista.filter(e => e.tipo === tipo).length

    // Série por dia. Em 90 dias vira por semana, senão o gráfico fica ilegível.
    const agruparPorSemana = dias > 30
    const baldes = new Map<string, { rotulo: string; visitas: number; conversas: number }>()
    for (let i = 0; i < dias; i++) {
      const d = new Date(inicioAtual)
      d.setDate(d.getDate() + i)
      const chave = agruparPorSemana
        ? chaveDia(new Date(d.getTime() - ((d.getDay() + 6) % 7) * 86400000))
        : chaveDia(d)
      if (!baldes.has(chave)) {
        baldes.set(chave, { rotulo: rotuloDia(new Date(chave + 'T12:00:00')), visitas: 0, conversas: 0 })
      }
    }
    for (const e of atuais) {
      const d = inicioDoDia(new Date(e.criado_em))
      const chave = agruparPorSemana
        ? chaveDia(new Date(d.getTime() - ((d.getDay() + 6) % 7) * 86400000))
        : chaveDia(d)
      const balde = baldes.get(chave)
      if (!balde) continue
      if (e.tipo === 'visita') balde.visitas++
      if (e.tipo === 'whatsapp') balde.conversas++
    }

    // Quebra por origem: qual link realmente traz gente que abre conversa.
    const porOrigem = new Map<string, { visitas: number; conversas: number }>()
    for (const e of atuais) {
      const chave = e.origem ?? '__direto'
      const linha = porOrigem.get(chave) ?? { visitas: 0, conversas: 0 }
      if (e.tipo === 'visita') linha.visitas++
      if (e.tipo === 'whatsapp') linha.conversas++
      porOrigem.set(chave, linha)
    }

    const celular = atuais.filter(e => e.tipo === 'visita' && e.dispositivo === 'celular').length
    const visitas = contar(atuais, 'visita')

    return {
      visitas,
      conversas: contar(atuais, 'whatsapp'),
      instagram: contar(atuais, 'instagram'),
      maps: contar(atuais, 'maps'),
      visitasAntes: contar(anteriores, 'visita'),
      conversasAntes: contar(anteriores, 'whatsapp'),
      percentualCelular: visitas > 0 ? Math.round((celular / visitas) * 100) : 0,
      serie: Array.from(baldes.values()),
      origens: Array.from(porOrigem.entries())
        .map(([chave, v]) => ({
          nome: chave === '__direto' ? ORIGEM_SEM_MARCA : (NOME_ORIGEM[chave] ?? chave),
          ...v,
          taxa: v.visitas > 0 ? Math.round((v.conversas / v.visitas) * 100) : 0,
        }))
        .sort((a, b) => b.visitas - a.visitas),
    }
  }, [eventos, dias])

  const taxa = dados.visitas > 0 ? Math.round((dados.conversas / dados.visitas) * 100) : 0
  const taxaAntes = dados.visitasAntes > 0
    ? Math.round((dados.conversasAntes / dados.visitasAntes) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-wide text-brand-dark">Marketing</h1>
          <p className="mt-1 text-sm text-brand-text-soft">
            Quem chegou na página de agendamento e quantas abriram conversa no WhatsApp
          </p>
        </div>
        <div className="flex gap-2">
          {PERIODOS.map(p => (
            <Button
              key={p.dias}
              size="sm"
              variant={dias === p.dias ? 'default' : 'outline'}
              onClick={() => setDias(p.dias)}
              className={dias === p.dias ? 'bg-brand-text-soft text-primary-foreground hover:bg-primary' : ''}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {semTabela && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base text-amber-900">Falta ligar a medição</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-900">
            <p>A tabela de eventos ainda não existe no banco. Pra ligar:</p>
            <p>1. No Supabase, abra o <strong>SQL Editor</strong> e rode o arquivo <code>supabase-eventos.sql</code> do projeto.</p>
            <p>2. No Vercel, adicione a variável <strong>SUPABASE_SERVICE_ROLE_KEY</strong> (está em Supabase → Settings → API) e faça um novo deploy.</p>
            <p className="pt-1">Até lá esta tela fica zerada — nada mais do sistema é afetado.</p>
          </CardContent>
        </Card>
      )}

      {carregando ? (
        <p className="text-sm text-brand-muted">Carregando...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-brand-text-soft">
                  <Eye className="h-4 w-4" /> Visitas na página
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums text-brand-dark">{dados.visitas}</p>
                <Delta atual={dados.visitas} anterior={dados.visitasAntes} />
              </CardContent>
            </Card>

            <Card className="border-brand-medium/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-brand-text-soft">
                  <MessageCircle className="h-4 w-4" /> Conversas abertas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums text-brand-dark">{dados.conversas}</p>
                <Delta atual={dados.conversas} anterior={dados.conversasAntes} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-brand-text-soft">
                  Taxa de conversão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums text-brand-dark">{taxa}%</p>
                <p className="mt-1 text-xs text-brand-muted">
                  de cada 100 visitas, {taxa} clicaram no WhatsApp
                  {taxaAntes > 0 && ` · antes era ${taxaAntes}%`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-brand-text-soft">
                  <ExternalLink className="h-4 w-4" /> Outros cliques
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums text-brand-dark">
                  {dados.instagram + dados.maps}
                </p>
                <p className="mt-1 text-xs text-brand-muted">
                  {dados.instagram} no Instagram · {dados.maps} em “como chegar”
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Movimento {dias > 30 ? 'por semana' : 'por dia'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dados.serie}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="visitas" name="Visitas" fill="var(--brand-gold)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="conversas" name="Conversas" fill="var(--brand-medium)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {dados.visitas > 0 && dados.visitas < 60 && (
                <p className="mt-3 text-xs text-brand-muted">
                  Com esse volume, a diferença de um dia pro outro é ruído. O número que
                  vale olhar é a comparação de período inteiro, nos cartões acima.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" /> De onde vem quem chega
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dados.origens.length === 0 ? (
                <p className="text-sm text-brand-muted">
                  Nenhuma visita registrada ainda neste período.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-brand-border text-left text-xs uppercase tracking-wider text-brand-muted">
                        <th className="pb-2 pr-4 font-medium">Origem</th>
                        <th className="pb-2 pr-4 text-right font-medium">Visitas</th>
                        <th className="pb-2 pr-4 text-right font-medium">Conversas</th>
                        <th className="pb-2 text-right font-medium">Taxa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.origens.map(o => (
                        <tr key={o.nome} className="border-b border-brand-border/50 last:border-0">
                          <td className="py-2.5 pr-4 text-brand-dark">{o.nome}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums text-brand-text-soft">{o.visitas}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums font-medium text-brand-dark">{o.conversas}</td>
                          <td className="py-2.5 text-right tabular-nums text-brand-text-soft">{o.taxa}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-4 text-xs leading-relaxed text-brand-muted">
                {dados.percentualCelular > 0 && (
                  <>{dados.percentualCelular}% das visitas vieram de celular. </>
                )}
                “Direto ou link sem marcação” é quem digitou o endereço, salvou nos favoritos —
                ou chegou por um link publicado sem <code>?origem=</code>.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-brand-surface">
            <CardHeader>
              <CardTitle className="text-base">O que este painel não enxerga</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-relaxed text-brand-text-soft">
              <p>
                <strong>Se a mensagem foi realmente enviada.</strong> O clique no botão é o
                último passo que acontece dentro da página; depois disso o WhatsApp assume.
                “Conversas abertas” quer dizer que a pessoa chegou na tela de conversa com o
                texto já escrito — quem confirma o envio é a caixa de entrada da Camila.
              </p>
              <p>
                <strong>O movimento do Perfil do Google.</strong> Quantas pessoas viram o perfil,
                pediram rota ou ligaram só aparece no painel de Desempenho do próprio Google.
                Aqui entra só quem clicou no site e caiu nesta página.
              </p>
              <p>
                <strong>Link sem marcação não tem origem.</strong> Todo link publicado precisa
                terminar com <code>?origem=</code> — <code>instagram</code> na bio,{' '}
                <code>google</code> no perfil, o nome do anúncio em cada anúncio. Sem isso a
                visita existe, mas cai em “direto”.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
