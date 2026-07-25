'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [error, setError] = useState(() =>
    searchParams.get('erro') === 'link_invalido'
      ? 'Esse link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".'
      : ''
  )

  // Link de recuperação de senha do Supabase chega como #access_token=...&type=recovery
  // direto nessa página (fragmento de URL, não dá pra tratar no servidor). O client
  // detecta e dispara esse evento — daí a gente manda pra tela de nova senha.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.push('/redefinir-senha')
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [router, supabase])

  async function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha incorretos. Tente novamente.')
      setLoading(false)
    } else {
      router.push('/agendamentos')
      router.refresh()
    }
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
            <CardTitle className="text-xl">Entrar</CardTitle>
            <CardDescription>Acesse sua conta para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Link href="/esqueci-senha" className="text-xs text-primary hover:underline">
                    Esqueci minha senha
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted-soft hover:text-brand-text-soft"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-danger-soft border border-danger/20 p-3 text-sm text-danger">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full bg-brand-text-soft text-primary-foreground hover:bg-primary" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
