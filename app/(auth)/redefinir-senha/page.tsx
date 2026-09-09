'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'

export default function RedefinirSenhaPage() {
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  const [pronto, setPronto] = useState(false)
  const [semSessao, setSemSessao] = useState(false)
  // Caminho por código: funciona mesmo quando o link do e-mail é aberto num navegador
  // diferente do que pediu o reset (caso do app do Gmail), que é onde o PKCE quebra.
  const [emailCodigo, setEmailCodigo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [validandoCodigo, setValidandoCodigo] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function validarCodigo(e: React.SyntheticEvent) {
    e.preventDefault()
    setErro('')
    const codigoLimpo = codigo.replace(/\D/g, '')
    if (!emailCodigo.trim() || codigoLimpo.length < 6) {
      setErro('Preencha o e-mail e o código de 6 dígitos que chegou na sua caixa de entrada.')
      return
    }
    setValidandoCodigo(true)
    const { error } = await supabase.auth.verifyOtp({
      email: emailCodigo.trim(),
      token: codigoLimpo,
      type: 'recovery',
    })
    setValidandoCodigo(false)
    if (error) {
      setErro('Código inválido ou expirado. Peça um novo em "Esqueci minha senha".')
      return
    }
    setSemSessao(false)
  }

  useEffect(() => {
    // O token de recuperação chega no fragmento da URL (#access_token=...) e o
    // supabase-js leva um instante pra processar e criar a sessão no cliente.
    // Antes isso era um getSession() único e imediato: quando o supabase-js ainda
    // não tinha terminado de processar o fragmento, a tela já cravava "link expirou"
    // e nunca mais reconferia — com o link perfeitamente válido na mão da pessoa.
    // Agora escutamos o evento de sessão e só desistimos depois de dar tempo.
    let achouSessao = false

    function liberar() {
      achouSessao = true
      setSemSessao(false)
      setPronto(true)
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) liberar()
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) liberar()
    })

    const desistirEm = setTimeout(() => {
      if (!achouSessao) {
        setSemSessao(true)
        setPronto(true)
      }
    }, 4000)

    return () => {
      listener.subscription.unsubscribe()
      clearTimeout(desistirEm)
    }
  }, [supabase])

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setErro('')

    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (senha !== confirmar) {
      setErro('As senhas não são iguais.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setLoading(false)

    if (error) {
      setErro('Não foi possível atualizar a senha. O link pode ter expirado — peça um novo em "Esqueci minha senha".')
      return
    }

    setOk(true)
    setTimeout(() => {
      router.push('/agendamentos')
      router.refresh()
    }, 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo/selo-cg.png" alt="CG" width={110} height={110} priority className="mb-3" />
          <h1
            className="text-3xl text-brand-text-soft tracking-[0.08em]"
            style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 600 }}
          >
            CAMILA GARCIA
          </h1>
          <p className="mt-1 text-xs tracking-[0.4em] text-brand-gold font-medium">ESTÉTICA</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">Nova senha</CardTitle>
            <CardDescription>
              {!pronto
                ? 'Verificando o link...'
                : semSessao
                ? 'Confirme o código que enviamos por e-mail'
                : ok
                ? 'Senha atualizada! Entrando...'
                : 'Escolha uma senha nova para acessar o sistema'}
            </CardDescription>
          </CardHeader>
          {pronto && semSessao && (
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Digite o <strong>código de 6 dígitos</strong> que chegou no seu e-mail. Ele funciona
                mesmo que o link não tenha aberto direito.
              </p>
              <form onSubmit={validarCodigo} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-codigo">Seu e-mail</Label>
                  <Input
                    id="email-codigo"
                    type="email"
                    placeholder="seu@email.com"
                    value={emailCodigo}
                    onChange={(e) => setEmailCodigo(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código de 6 dígitos</Label>
                  <Input
                    id="codigo"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    required
                  />
                </div>

                {erro && (
                  <div className="rounded-md bg-danger-soft border border-danger/20 p-3 text-sm text-danger">
                    {erro}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-brand-text-soft text-primary-foreground hover:bg-primary"
                  disabled={validandoCodigo}
                >
                  {validandoCodigo ? 'Verificando...' : 'Continuar'}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground mt-4">
                <Link href="/esqueci-senha" className="text-primary font-medium hover:underline">
                  Pedir um novo código
                </Link>
              </p>
            </CardContent>
          )}
          {pronto && !semSessao && !ok && (
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha nova</Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={mostrar ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setMostrar(!mostrar)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted-soft hover:text-brand-text-soft"
                    >
                      {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmar">Confirmar senha</Label>
                  <Input
                    id="confirmar"
                    type={mostrar ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    required
                  />
                </div>

                {erro && (
                  <div className="rounded-md bg-danger-soft border border-danger/20 p-3 text-sm text-danger">
                    {erro}
                  </div>
                )}

                <Button type="submit" className="w-full bg-brand-text-soft text-primary-foreground hover:bg-primary" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar senha nova'}
                </Button>
              </form>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
