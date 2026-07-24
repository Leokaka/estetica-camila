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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F5F0EA]">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo/selo-cg.png" alt="CG" width={110} height={110} priority className="mb-3" />
          <h1
            className="text-3xl text-[#5E4433] tracking-[0.08em]"
            style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 600 }}
          >
            CAMILA GARCIA
          </h1>
          <p className="mt-1 text-xs tracking-[0.4em] text-[#C9A96E] font-medium">ESTÉTICA</p>
        </div>

        <Card className="shadow-xl bg-[#FBF9F5] border border-[#E8DFD2]">
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
                  <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                    {erro}
                  </div>
                )}

                <Button type="submit" className="w-full bg-[#5E4433] text-[#F5F0EA] hover:bg-[#7A5C4A]" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar link'}
                </Button>
              </form>
            ) : null}

            <p className="text-center text-sm text-[#8A7160] mt-4">
              <Link href="/login" className="text-[#7A5C4A] font-medium hover:underline">
                ← Voltar pro login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
