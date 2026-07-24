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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Lancamento } from '@/types'

const CATEGORIAS_ENTRADA = ['Serviço', 'Produto', 'Outros']
const CATEGORIAS_SAIDA = ['Produto/Material', 'Aluguel', 'Energia', 'Água', 'Internet', 'Marketing', 'Equipamento', 'Curso/Capacitação', 'Impostos', 'Outros']
const COLORS = ['#e11d48', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

const EMPTY_FORM = { tipo: 'saida', descricao: '', valor: '', categoria: '', data: format(new Date(), 'yyyy-MM-dd') }

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function FinanceiroPage() {
  const supabase = createClient()
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [mesAtual, setMesAtual] = useState(new Date())
  const [filtroTipo, setFiltroTipo] = useState('todos')

  useEffect(() => { loadLancamentos() }, [mesAtual])

  async function loadLancamentos() {
    setLoading(true)
    const inicio = format(startOfMonth(mesAtual), 'yyyy-MM-dd')
    const fim = format(endOfMonth(mesAtual), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('lancamentos')
      .select('*')
      .gte('data', inicio)
      .lte('data', fim)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
    setLancamentos(data ?? [])
    setLoading(false)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const { error } = await supabase.from('lancamentos').insert({
      tipo: form.tipo,
      descricao: form.descricao,
      valor: Number(form.valor),
      categoria: form.categoria,
      data: form.data,
    })
    if (error) toast.error('Erro ao salvar lançamento')
    else { toast.success('Lançamento registrado!'); setDialogOpen(false); loadLancamentos() }
    setSalvando(false)
  }

  async function excluir(id: string) {
    if (!confirm('Deseja excluir este lançamento?')) return
    const { error } = await supabase.from('lancamentos').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Lançamento excluído'); loadLancamentos() }
  }

  const entradas = lancamentos.filter(l => l.tipo === 'entrada')
  const saidas = lancamentos.filter(l => l.tipo === 'saida')
  const totalEntradas = entradas.reduce((s, l) => s + Number(l.valor), 0)
  const totalSaidas = saidas.reduce((s, l) => s + Number(l.valor), 0)
  const lucro = totalEntradas - totalSaidas
  const margemLucro = totalEntradas > 0 ? (lucro / totalEntradas * 100) : 0

  const lancamentosFiltrados = filtroTipo === 'todos' ? lancamentos
    : lancamentos.filter(l => l.tipo === filtroTipo)

  // Dados para gráfico de despesas por categoria
  const despesasPorCategoria = saidas.reduce((acc: Record<string, number>, l) => {
    acc[l.categoria] = (acc[l.categoria] ?? 0) + Number(l.valor)
    return acc
  }, {})
  const pieData = Object.entries(despesasPorCategoria).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-500">{format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setDialogOpen(true) }} className="bg-[#7A5C4A] hover:bg-[#5C3D20]">
          <Plus className="h-4 w-4 mr-2" /> Novo Lançamento
        </Button>
      </div>

      {/* Navegação de mês */}
      <div className="flex gap-2 items-center">
        <Button variant="outline" size="sm" onClick={() => setMesAtual(m => subMonths(m, 1))}>← Anterior</Button>
        <span className="text-sm font-medium px-2">{format(mesAtual, "MMMM yyyy", { locale: ptBR })}</span>
        <Button variant="outline" size="sm" onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() + 1))}>Próximo →</Button>
        <Button variant="ghost" size="sm" onClick={() => setMesAtual(new Date())} className="text-[#7A5C4A]">Hoje</Button>
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Entradas</CardTitle>
            <ArrowUpCircle className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalEntradas)}</p>
            <p className="text-xs text-gray-400 mt-1">{entradas.length} registros</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Saídas</CardTitle>
            <ArrowDownCircle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(totalSaidas)}</p>
            <p className="text-xs text-gray-400 mt-1">{saidas.length} registros</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Lucro Líquido</CardTitle>
            <DollarSign className={`h-5 w-5 ${lucro >= 0 ? 'text-green-600' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${lucro >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {formatCurrency(lucro)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {lucro >= 0 ? 'Positivo' : 'Negativo'} no mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Margem de Lucro</CardTitle>
            <TrendingUp className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${margemLucro >= 40 ? 'text-green-600' : margemLucro >= 20 ? 'text-amber-600' : 'text-red-500'}`}>
              {margemLucro.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {margemLucro >= 40 ? 'Saudável' : margemLucro >= 20 ? 'Atenção' : 'Crítico'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de lançamentos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2">
            {['todos', 'entrada', 'saida'].map(tipo => (
              <Button
                key={tipo}
                size="sm"
                variant={filtroTipo === tipo ? 'default' : 'outline'}
                className={filtroTipo === tipo ? 'bg-[#7A5C4A] hover:bg-[#5C3D20]' : ''}
                onClick={() => setFiltroTipo(tipo)}
              >
                {tipo === 'todos' ? 'Todos' : tipo === 'entrada' ? 'Entradas' : 'Saídas'}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Carregando...</div>
          ) : lancamentosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Nenhum lançamento neste mês</div>
          ) : (
            <div className="space-y-2">
              {lancamentosFiltrados.map((l) => (
                <div key={l.id} className="flex items-center gap-4 p-3 rounded-lg border bg-white hover:shadow-sm transition-shadow">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${l.tipo === 'entrada' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {l.tipo === 'entrada'
                      ? <ArrowUpCircle className="h-5 w-5 text-green-600" />
                      : <ArrowDownCircle className="h-5 w-5 text-red-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{l.descricao}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs px-1.5 py-0">{l.categoria}</Badge>
                      <span className="text-xs text-gray-400">{format(new Date(l.data + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className={`font-bold ${l.tipo === 'entrada' ? 'text-green-600' : 'text-red-500'}`}>
                      {l.tipo === 'entrada' ? '+' : '-'}{formatCurrency(Number(l.valor))}
                    </p>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => excluir(l.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gráfico de despesas */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Despesas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sem despesas registradas</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(despesasPorCategoria)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, valor], i) => (
                    <div key={cat} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-sm">{cat}</span>
                      </div>
                      <span className="text-sm font-medium text-red-500">{formatCurrency(valor)}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Lançamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, tipo: 'entrada', categoria: '' }))}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${form.tipo === 'entrada' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <ArrowUpCircle className="h-4 w-4" /> Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, tipo: 'saida', categoria: '' }))}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${form.tipo === 'saida' ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <ArrowDownCircle className="h-4 w-4" /> Saída
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Compra de produtos" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v ?? form.categoria })}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  {(form.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA).map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1 bg-[#7A5C4A] hover:bg-[#5C3D20]" disabled={salvando || !form.categoria}>
                {salvando ? 'Salvando...' : 'Registrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
