'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, CheckCircle, XCircle, Calendar, MessageCircle, UserPlus } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Agendamento, Cliente, Servico } from '@/types'
import { diaFunciona, horariosDisponiveis, agendamentosParaOcupados } from '@/lib/agenda'

const STATUS_COLORS: Record<string, string> = {
  agendado: 'bg-blue-100 text-[#8A6A2E]',
  confirmado: 'bg-green-100 text-[#4F7A54]',
  realizado: 'bg-gray-100 text-gray-700',
  cancelado: 'bg-red-100 text-red-700',
}

const EMPTY_FORM = {
  cliente_id: '', servico_id: '', data: '', hora: '', status: 'agendado',
  local: 'quartinho', valor_cobrado: '', observacoes: ''
}

// Promoção de inauguração — arredonda pra baixo (bate com a tabela divulgada)
const PROMO_ATIVA = true
const PROMO_LABEL = '15% de inauguração'
function precoPromo(preco: number) {
  return Math.floor(preco * 0.85)
}

const ENDERECO = 'Rua São Teodoro, 833 · Vila Carmosina (2º andar)'

function mensagemConfirmacao(nome: string, servico: string, dataHora: Date, valor: number, promo: boolean) {
  const data = format(dataHora, 'dd/MM/yyyy')
  const hora = format(dataHora, 'HH:mm')
  return `Oi, ${nome.split(' ')[0]}! Aqui é a Camila 💛\n\nSeu agendamento está confirmado:\n✨ ${servico}\n📅 ${data} às ${hora}\n💰 R$ ${valor}${promo ? ` (com ${PROMO_LABEL})` : ''}\n📍 ${ENDERECO}\n\nQualquer coisa é só me chamar por aqui. Até lá! 😊`
}

function linkWhatsApp(telefone: string, texto: string) {
  const d = telefone.replace(/\D/g, '')
  const num = d.length <= 11 ? `55${d}` : d
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function AgendamentosPage() {
  const supabase = createClient()
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Agendamento | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [mesAtual, setMesAtual] = useState(new Date())
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [promo15, setPromo15] = useState(false)
  const [novaCliente, setNovaCliente] = useState<{ nome: string; telefone: string } | null>(null)
  const [salvandoCliente, setSalvandoCliente] = useState(false)

  useEffect(() => {
    loadData()
  }, [mesAtual])

  async function loadData() {
    setLoading(true)
    const inicio = startOfMonth(mesAtual).toISOString()
    const fim = endOfMonth(mesAtual).toISOString()

    const [{ data: ags }, { data: cls }, { data: svs }] = await Promise.all([
      supabase.from('agendamentos')
        .select('*, cliente:clientes(id, nome, telefone), servico:servicos(id, nome, preco, duracao_minutos)')
        .gte('data_hora', inicio).lte('data_hora', fim)
        .order('data_hora'),
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
    ])

    setAgendamentos((ags as any) ?? [])
    setClientes(cls ?? [])
    setServicos(svs ?? [])
    setLoading(false)
  }

  function abrirNovo(data?: Date) {
    setEditando(null)
    setForm({ ...EMPTY_FORM, data: data ? format(data, 'yyyy-MM-dd') : '' })
    setPromo15(false)
    setNovaCliente(null)
    setDialogOpen(true)
  }

  function abrirEditar(ag: Agendamento) {
    setEditando(ag)
    const dt = new Date(ag.data_hora)
    setForm({
      cliente_id: ag.cliente_id,
      servico_id: ag.servico_id,
      data: format(dt, 'yyyy-MM-dd'),
      hora: format(dt, 'HH:mm'),
      status: ag.status,
      local: ag.local ?? 'quartinho',
      valor_cobrado: String(ag.valor_cobrado),
      observacoes: ag.observacoes ?? '',
    })
    setDialogOpen(true)
  }

  // Horários possíveis pro serviço+data escolhidos, descontando almoço e conflitos.
  // Ao editar, o próprio agendamento não conta como conflito consigo mesmo.
  const servicoEscolhido = servicos.find(s => s.id === form.servico_id)
  const horariosDoServico = (() => {
    if (!form.servico_id || !form.data) return []
    const duracao = servicoEscolhido?.duracao_minutos ?? 60
    const dataObj = new Date(form.data + 'T00:00:00')
    const ocupados = agendamentosParaOcupados(
      agendamentos.filter((ag: any) =>
        ag.status !== 'cancelado' &&
        ag.id !== editando?.id &&
        isSameDay(new Date(ag.data_hora), dataObj)
      )
    )
    return horariosDisponiveis({ duracaoMinutos: duracao, ocupados })
  })()

  function onSelectServico(servicoId: string | null) {
    const id = servicoId ?? ''
    const svc = servicos.find(s => s.id === id)
    const base = svc ? Number(svc.preco) : null
    setForm(f => ({
      ...f,
      servico_id: id,
      valor_cobrado: base !== null ? String(promo15 ? precoPromo(base) : base) : f.valor_cobrado,
    }))
  }

  function togglePromo(checked: boolean) {
    setPromo15(checked)
    const svc = servicos.find(s => s.id === form.servico_id)
    if (svc) {
      const base = Number(svc.preco)
      setForm(f => ({ ...f, valor_cobrado: String(checked ? precoPromo(base) : base) }))
    }
  }

  async function salvarNovaCliente() {
    if (!novaCliente?.nome.trim() || novaCliente.telefone.replace(/\D/g, '').length < 10) {
      toast.error('Preenche nome e WhatsApp da cliente.')
      return
    }
    setSalvandoCliente(true)
    const { data, error } = await supabase
      .from('clientes')
      .insert({ nome: novaCliente.nome.trim(), telefone: novaCliente.telefone })
      .select()
      .single()
    setSalvandoCliente(false)
    if (error || !data) { toast.error('Erro ao cadastrar cliente'); return }
    setClientes(cs => [...cs, data].sort((a, b) => a.nome.localeCompare(b.nome)))
    setForm(f => ({ ...f, cliente_id: data.id }))
    setNovaCliente(null)
    toast.success(`${data.nome} cadastrada!`)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      cliente_id: form.cliente_id,
      servico_id: form.servico_id,
      data_hora: new Date(`${form.data}T${form.hora}:00`).toISOString(),
      status: form.status as Agendamento['status'],
      local: form.local as Agendamento['local'],
      valor_cobrado: Number(form.valor_cobrado),
      observacoes: form.observacoes || null,
    }

    if (editando) {
      const { error } = await supabase.from('agendamentos').update(payload).eq('id', editando.id)
      if (error) toast.error('Erro ao atualizar agendamento')
      else {
        if (payload.status === 'realizado') {
          await registrarEntradaFinanceira(editando.id, payload)
        }
        toast.success('Agendamento atualizado!')
        setDialogOpen(false)
        loadData()
      }
    } else {
      const { data, error } = await supabase.from('agendamentos').insert(payload).select().single()
      if (error) toast.error('Erro ao criar agendamento')
      else {
        if (payload.status === 'realizado' && data) {
          await registrarEntradaFinanceira(data.id, payload)
        }
        toast.success('Agendamento criado!')
        setDialogOpen(false)
        loadData()
      }
    }
    setSalvando(false)
  }

  async function registrarEntradaFinanceira(agendamentoId: string, payload: any) {
    const cliente = clientes.find(c => c.id === payload.cliente_id)
    const servico = servicos.find(s => s.id === payload.servico_id)
    const desc = `${servico?.nome ?? 'Serviço'} - ${cliente?.nome ?? 'Cliente'}`
    await supabase.from('lancamentos').insert({
      tipo: 'entrada',
      descricao: desc,
      valor: Number(payload.valor_cobrado),
      categoria: 'Serviço',
      data: format(new Date(payload.data_hora), 'yyyy-MM-dd'),
      agendamento_id: agendamentoId,
    })
  }

  async function marcarRealizado(ag: Agendamento) {
    const valor = formatCurrency(Number(ag.valor_cobrado))
    if (!confirm(`Confirmar "${ag.cliente?.nome}" como realizado?\n\nIsso lança ${valor} automaticamente no Financeiro.`)) return
    const { error } = await supabase.from('agendamentos').update({ status: 'realizado' }).eq('id', ag.id)
    if (!error) {
      await registrarEntradaFinanceira(ag.id, { ...ag, data_hora: ag.data_hora })
      toast.success(`Realizado! ${valor} lançado no financeiro.`)
      loadData()
    }
  }

  async function cancelar(id: string) {
    if (!confirm('Deseja cancelar este agendamento?')) return
    const { error } = await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', id)
    if (error) toast.error('Erro ao cancelar')
    else { toast.success('Agendamento cancelado'); loadData() }
  }

  async function excluir(id: string) {
    if (!confirm('Deseja excluir este agendamento?')) return
    const { error } = await supabase.from('agendamentos').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Agendamento excluído'); loadData() }
  }

  const diasDoMes = eachDayOfInterval({ start: startOfMonth(mesAtual), end: endOfMonth(mesAtual) })
  const agendamentosDoDia = diaSelecionado
    ? agendamentos.filter(ag => isSameDay(new Date(ag.data_hora), diaSelecionado))
    : []

  const agendamentosFiltrados = filtroStatus === 'todos'
    ? agendamentos
    : agendamentos.filter(ag => ag.status === filtroStatus)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-[#2E2015] tracking-wide">Agendamentos</h1>
          <p className="text-[#8A7160]">{format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
        <Button onClick={() => abrirNovo()} className="bg-[#7A5C4A] hover:bg-[#5C3D20]">
          <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
        </Button>
      </div>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['todos', 'agendado', 'confirmado', 'realizado', 'cancelado'].map(s => (
              <Button
                key={s}
                size="sm"
                variant={filtroStatus === s ? 'default' : 'outline'}
                className={filtroStatus === s ? 'bg-[#7A5C4A] hover:bg-[#5C3D20]' : ''}
                onClick={() => setFiltroStatus(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>

          <div className="flex gap-2 items-center">
            <Button variant="outline" size="sm" onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() - 1))}>
              ← Anterior
            </Button>
            <span className="text-sm font-medium px-2">{format(mesAtual, "MMMM yyyy", { locale: ptBR })}</span>
            <Button variant="outline" size="sm" onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() + 1))}>
              Próximo →
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-[#A8927E]">Carregando...</div>
          ) : agendamentosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-[#A8927E]">Nenhum agendamento neste mês</div>
          ) : (
            <div className="space-y-2">
              {agendamentosFiltrados.map((ag: any) => (
                <Card key={ag.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-sm">{ag.cliente?.nome}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[ag.status]}`}>
                          {ag.status}
                        </span>
                      </div>
                      <p className="text-sm text-[#8A7160] truncate">{ag.servico?.nome}</p>
                      <p className="text-xs text-[#A8927E]">
                        {format(new Date(ag.data_hora), "dd/MM 'às' HH:mm")}
                      </p>
                      <div className="flex gap-1 mt-2">
                        {ag.status !== 'realizado' && ag.status !== 'cancelado' && (
                          <Button size="sm" variant="outline" className="text-[#4F7A54] h-7 px-2 text-xs" onClick={() => marcarRealizado(ag)}>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Realizado
                          </Button>
                        )}
                        {ag.cliente?.telefone && ag.status !== 'cancelado' && (
                          <Button
                            size="sm" variant="outline"
                            className="text-[#4F7A54] h-7 px-2"
                            title="Enviar confirmação no WhatsApp"
                            onClick={() => window.open(
                              linkWhatsApp(
                                ag.cliente.telefone,
                                mensagemConfirmacao(ag.cliente.nome, ag.servico?.nome ?? 'seu procedimento', new Date(ag.data_hora), Number(ag.valor_cobrado), false)
                              ), '_blank')}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {ag.status !== 'cancelado' && ag.status !== 'realizado' && (
                          <Button size="sm" variant="outline" className="text-[#B5493A] h-7 px-2" onClick={() => cancelar(ag.id)} title="Cancelar">
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => abrirEditar(ag)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-[#B5493A] h-7 px-2" onClick={() => excluir(ag.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-[#7A5C4A]">{formatCurrency(ag.valor_cobrado)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendario">
          <div className="space-y-4">
            <div className="flex gap-2 items-center">
              <Button variant="outline" size="sm" onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() - 1))}>
                ← Anterior
              </Button>
              <span className="text-sm font-medium px-2">{format(mesAtual, "MMMM yyyy", { locale: ptBR })}</span>
              <Button variant="outline" size="sm" onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() + 1))}>
                Próximo →
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="text-center text-xs font-medium text-[#8A7160] py-2">{d}</div>
              ))}
              {Array.from({ length: diasDoMes[0].getDay() }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {diasDoMes.map(dia => {
                const agsNoDia = agendamentos.filter(ag => isSameDay(new Date(ag.data_hora), dia))
                const hoje = isToday(dia)
                const selecionado = diaSelecionado && isSameDay(dia, diaSelecionado)
                return (
                  <button
                    key={dia.toISOString()}
                    onClick={() => setDiaSelecionado(selecionado ? null : dia)}
                    className={`relative p-2 rounded-lg text-sm text-center transition-all min-h-[60px] flex flex-col items-center gap-1
                      ${hoje ? 'ring-2 ring-[#C9A96E]' : ''}
                      ${selecionado ? 'bg-[#7A5C4A] text-white' : 'hover:bg-gray-100'}
                    `}
                  >
                    <span className="font-medium">{format(dia, 'd')}</span>
                    {agsNoDia.length > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${selecionado ? 'bg-white text-[#7A5C4A]' : 'bg-[#EEE0D4] text-[#7A5C4A]'}`}>
                        {agsNoDia.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {diaSelecionado && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{format(diaSelecionado, "dd 'de' MMMM", { locale: ptBR })}</span>
                    <Button size="sm" className="bg-[#7A5C4A] hover:bg-[#5C3D20]" onClick={() => abrirNovo(diaSelecionado)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Agendar
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {agendamentosDoDia.length === 0 ? (
                    <p className="text-sm text-[#A8927E] text-center py-4">Nenhum agendamento neste dia</p>
                  ) : (
                    <div className="space-y-2">
                      {agendamentosDoDia.map((ag: any) => (
                        <div key={ag.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <p className="font-medium text-sm">{ag.cliente?.nome}</p>
                            <p className="text-xs text-[#8A7160]">{ag.servico?.nome} · {format(new Date(ag.data_hora), 'HH:mm')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-[#7A5C4A]">{formatCurrency(ag.valor_cobrado)}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[ag.status]}`}>{ag.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Cliente *</Label>
                <button
                  type="button"
                  onClick={() => setNovaCliente(nc => nc ? null : { nome: '', telefone: '' })}
                  className="flex items-center gap-1 text-xs font-medium text-[#7A5C4A] hover:underline"
                >
                  <UserPlus className="h-3.5 w-3.5" /> {novaCliente ? 'Cancelar' : 'Nova cliente'}
                </button>
              </div>
              {novaCliente ? (
                <div className="space-y-2 rounded-lg border border-[#C9A96E] bg-[#FBF9F5] p-3">
                  <Input
                    placeholder="Nome da cliente"
                    value={novaCliente.nome}
                    onChange={e => setNovaCliente(nc => nc && ({ ...nc, nome: e.target.value }))}
                  />
                  <Input
                    type="tel"
                    placeholder="WhatsApp (11) 9XXXX-XXXX"
                    value={novaCliente.telefone}
                    onChange={e => setNovaCliente(nc => nc && ({ ...nc, telefone: e.target.value }))}
                  />
                  <Button type="button" size="sm" className="w-full bg-[#7A5C4A] hover:bg-[#5C3D20]" disabled={salvandoCliente} onClick={salvarNovaCliente}>
                    {salvandoCliente ? 'Cadastrando...' : 'Cadastrar e selecionar'}
                  </Button>
                </div>
              ) : (
                <Select value={form.cliente_id} onValueChange={v => setForm(f => ({ ...f, cliente_id: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione a cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Serviço *</Label>
              <Select value={form.servico_id} onValueChange={onSelectServico}>
                <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                <SelectContent>
                  {servicos.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={e => setForm(f => ({ ...f, data: e.target.value, hora: '' }))}
                  required
                />
                {form.data && !diaFunciona(new Date(form.data + 'T00:00:00')) && (
                  <p className="text-xs text-[#B5493A]">Fechado aos domingos.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Horário *</Label>
                <Select
                  value={form.hora}
                  onValueChange={v => setForm(f => ({ ...f, hora: v ?? '' }))}
                  disabled={!form.servico_id || !form.data}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!form.servico_id ? 'Escolha o serviço primeiro' : 'Selecione'} />
                  </SelectTrigger>
                  <SelectContent>
                    {horariosDoServico.length === 0 && form.data && form.servico_id && (
                      <div className="px-3 py-2 text-xs text-[#8A7160]">Sem horário livre nesse dia pra esse serviço</div>
                    )}
                    {horariosDoServico.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                    {/* garante que o horário atual (edição) apareça mesmo se não estiver mais "livre" */}
                    {editando && form.hora && !horariosDoServico.includes(form.hora) && (
                      <SelectItem value={form.hora}>{form.hora} (atual)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.servico_id && (
              <p className="text-xs text-[#8A7160] -mt-1">
                Duração: {servicoEscolhido?.duracao_minutos ?? 60} min · almoço 13h–14h já é descontado
              </p>
            )}
            {PROMO_ATIVA && !editando && (
              <label className="flex items-center gap-2 rounded-lg border border-[#C4856A] bg-[#FBF3EE] p-3 text-sm font-medium text-[#C4856A] cursor-pointer">
                <input type="checkbox" checked={promo15} onChange={e => togglePromo(e.target.checked)} className="accent-[#C4856A]" />
                Aplicar {PROMO_LABEL} (15% OFF)
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={form.valor_cobrado} onChange={e => setForm(f => ({ ...f, valor_cobrado: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v ?? f.status }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                    <SelectItem value="realizado">Realizado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1 bg-[#7A5C4A] hover:bg-[#5C3D20]" disabled={salvando || !form.cliente_id || !form.servico_id || !form.data || !form.hora}>
                {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Agendar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
