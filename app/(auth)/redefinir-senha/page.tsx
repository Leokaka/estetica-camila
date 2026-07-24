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
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // O token de recuperação chega no fragmento da URL (#access_token=...) e o
    // supabase-js leva um instante pra processar e criar a sessão no cliente.
    // Só liberamos o formulário depois de confirmar que a sessão existe.
    supabase.auth.getSession().then(({ data }) => {
      setSemSessao(!data.session)
      setPronto(true)
    })
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
      router.push('/dashboard')
      router.refresh()
    }, 1500)
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
            <CardTitle className="text-xl">Nova senha</CardTitle>
            <CardDescription>
              {!pronto
                ? 'Verificando o link...'
                : semSessao
                ? 'Não encontramos um link válido'
                : ok
                ? 'Senha atualizada! Entrando...'
                : 'Escolha uma senha nova para acessar o sistema'}
            </CardDescription>
          </CardHeader>
          {pronto && semSessao && (
            <CardContent>
              <p className="text-sm text-[#8A7160] mb-4">
                Esse link expirou, já foi usado, ou você abriu essa página direto. Peça um novo link.
              </p>
              <Link href="/esqueci-senha">
                <Button className="w-full bg-[#5E4433] text-[#F5F0EA] hover:bg-[#7A5C4A]">
                  Pedir novo link
                </Button>
              </Link>
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                  <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                    {erro}
                  </div>
                )}

                <Button type="submit" className="w-full bg-[#5E4433] text-[#F5F0EA] hover:bg-[#7A5C4A]" disabled={loading}>
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
