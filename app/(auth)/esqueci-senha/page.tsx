'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')
  const supabase = createClient()

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })

    setLoading(false)
    if (error) {
      setErro('Não foi possível enviar o e-mail. Confere se o endereço está certo.')
      return
    }
    setEnviado(true)
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
            <CardTitle className="text-xl">Esqueci minha senha</CardTitle>
            <CardDescription>
              {enviado
                ? 'Prontinho! Confere sua caixa de entrada (e o spam) e clica no link.'
                : 'Digite seu e-mail e mandamos um link pra você criar uma senha nova'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!enviado ? (
              <form onSubmit={handleSubmit} className="space-y-4">
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

                {erro && (
                  <div className="rounded-md bg-danger-soft border border-danger/20 p-3 text-sm text-danger">
                    {erro}
                  </div>
                )}

                <Button type="submit" className="w-full bg-brand-text-soft text-primary-foreground hover:bg-primary" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar link'}
                </Button>
              </form>
            ) : null}

            <p className="text-center text-sm text-muted-foreground mt-4">
              <Link href="/login" className="text-primary font-medium hover:underline">
                ← Voltar pro login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
