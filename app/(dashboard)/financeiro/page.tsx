'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, TrendingUp, DollarSign, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Lancamento } from '@/types'
import { formatCurrency } from '@/lib/format'

const CATEGORIAS_ENTRADA = ['Serviço', 'Produto', 'Outros']
const CATEGORIAS_SAIDA = ['Produto/Material', 'Aluguel', 'Energia', 'Água', 'Internet', 'Marketing', 'Equipamento', 'Curso/Capacitação', 'Impostos', 'Outros']

// Paleta categórica validada (skill dataviz — 8 matizes, ordem fixa, CVD-safe).
// Contraste abaixo de 3:1 em 3 matizes é mitigado pela legenda + lista "Resumo por Categoria" ao lado.
const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const MAX_FATIAS = COLORS.length

const EMPTY_FORM = { tipo: 'saida', descricao: '', valor: '', categoria: '', data: format(new Date(), 'yyyy-MM-dd') }

function margemClasse(margem: number) {
  if (margem >= 40) return 'text-success'
  if (margem >= 20) return 'text-warning'
  return 'text-danger'
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
  const [excluindo, setExcluindo] = useState<Lancamento | null>(null)

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
    const { error } = await supabase.from('lancamentos').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Lançamento excluído'); loadLancamentos() }
    setExcluindo(null)
  }

  const entradas = lancamentos.filter(l => l.tipo === 'entrada')
  const saidas = lancamentos.filter(l => l.tipo === 'saida')
  const totalEntradas = entradas.reduce((s, l) => s + Number(l.valor), 0)
  const totalSaidas = saidas.reduce((s, l) => s + Number(l.valor), 0)
  const lucro = totalEntradas - totalSaidas
  const margemLucro = totalEntradas > 0 ? (lucro / totalEntradas * 100) : 0

  const lancamentosFiltrados = filtroTipo === 'todos' ? lancamentos
    : lancamentos.filter(l => l.tipo === filtroTipo)

  // Despesas por categoria, ordenadas por valor (maior primeiro) — mesma ordem
  // usada no gráfico e na lista ao lado, pra cor e categoria sempre baterem.
  const despesasPorCategoria = saidas.reduce((acc: Record<string, number>, l) => {
    acc[l.categoria] = (acc[l.categoria] ?? 0) + Number(l.valor)
    return acc
  }, {})
  const despesasOrdenadas = Object.entries(despesasPorCategoria).sort(([, a], [, b]) => b - a)
  const pieData = despesasOrdenadas.length > MAX_FATIAS
    ? [
        ...despesasOrdenadas.slice(0, MAX_FATIAS - 1).map(([name, value]) => ({ name, value })),
        { name: 'Outras', value: despesasOrdenadas.slice(MAX_FATIAS - 1).reduce((s, [, v]) => s + v, 0) },
      ]
    : despesasOrdenadas.map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-brand-dark tracking-wide">Financeiro</h1>
          <p className="text-muted-foreground">{format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Lançamento
        </Button>
      </div>

      {/* Navegação de mês */}
      <div className="flex gap-2 items-center">
        <Button variant="outline" size="sm" onClick={() => setMesAtual(m => subMonths(m, 1))}>← Anterior</Button>
        <span className="text-sm font-medium px-2">{format(mesAtual, "MMMM yyyy", { locale: ptBR })}</span>
        <Button variant="outline" size="sm" onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() + 1))}>Próximo →</Button>
        <Button variant="ghost" size="sm" onClick={() => setMesAtual(new Date())}>Hoje</Button>
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-brand-text-soft">Entradas</CardTitle>
            <ArrowUpCircle className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">{formatCurrency(totalEntradas)}</p>
            <p className="text-xs text-brand-muted-soft mt-1">{entradas.length} registros</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-brand-text-soft">Saídas</CardTitle>
            <ArrowDownCircle className="h-5 w-5 text-danger" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-danger">{formatCurrency(totalSaidas)}</p>
            <p className="text-xs text-brand-muted-soft mt-1">{saidas.length} registros</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-brand-text-soft">Lucro Líquido</CardTitle>
            <DollarSign className={`h-5 w-5 ${lucro >= 0 ? 'text-success' : 'text-danger'}`} />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${lucro >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatCurrency(lucro)}
            </p>
            <p className="text-xs text-brand-muted-soft mt-1">
              {lucro >= 0 ? 'Positivo' : 'Negativo'} no mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-brand-text-soft">Margem de Lucro</CardTitle>
            <TrendingUp className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${margemClasse(margemLucro)}`}>
              {margemLucro.toFixed(1)}%
            </p>
            <p className="text-xs text-brand-muted-soft mt-1">
              {margemLucro >= 40 ? 'Saudável' : margemLucro >= 20 ? 'Atenção' : 'Crítico'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de lançamentos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2">
            {(['todos', 'entrada', 'saida'] as const).map(tipo => (
              <Button
                key={tipo}
                size="sm"
                variant={filtroTipo === tipo ? 'default' : 'outline'}
                onClick={() => setFiltroTipo(tipo)}
              >
                {tipo === 'todos' ? 'Todos' : tipo === 'entrada' ? 'Entradas' : 'Saídas'}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-12 text-brand-muted-soft">Carregando...</div>
          ) : lancamentosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-brand-muted-soft">Nenhum lançamento neste mês</div>
          ) : (
            <div className="space-y-2">
              {lancamentosFiltrados.map((l) => (
                <div key={l.id} className="flex items-center gap-4 p-3 rounded-lg border border-brand-border bg-card hover:shadow-sm transition-shadow">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${l.tipo === 'entrada' ? 'bg-success-soft' : 'bg-danger-soft'}`}>
                    {l.tipo === 'entrada'
                      ? <ArrowUpCircle className="h-5 w-5 text-success" />
                      : <ArrowDownCircle className="h-5 w-5 text-danger" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{l.descricao}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs px-1.5 py-0">{l.categoria}</Badge>
                      <span className="text-xs text-brand-muted-soft">{format(new Date(l.data + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className={`font-bold ${l.tipo === 'entrada' ? 'text-success' : 'text-danger'}`}>
                      {l.tipo === 'entrada' ? '+' : '-'}{formatCurrency(Number(l.valor))}
                    </p>
                    <Button size="icon-sm" variant="ghost" className="text-brand-muted-soft hover:text-danger" onClick={() => setExcluindo(l)}>
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
                <p className="text-sm text-brand-muted-soft text-center py-8">Sem despesas registradas</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="var(--brand-card)" strokeWidth={2} />
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
                {pieData.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium text-danger">{formatCurrency(item.value)}</span>
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
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${form.tipo === 'entrada' ? 'border-success/40 bg-success-soft text-success' : 'border-border hover:border-brand-muted-soft'}`}
                >
                  <ArrowUpCircle className="h-4 w-4" /> Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, tipo: 'saida', categoria: '' }))}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${form.tipo === 'saida' ? 'border-danger/40 bg-danger-soft text-danger' : 'border-border hover:border-brand-muted-soft'}`}
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
                <SelectTrigger><SelectValue placeholder="Selecione a categoria">{form.categoria}</SelectValue></SelectTrigger>
                <SelectContent>
                  {(form.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA).map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={salvando || !form.categoria}>
                {salvando ? 'Salvando...' : 'Registrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluindo} onOpenChange={(open) => !open && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove &quot;{excluindo?.descricao}&quot; do financeiro do mês e não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => excluindo && excluir(excluindo.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
