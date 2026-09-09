import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'
  )
  // Nota: não adianta passar `flowType: 'implicit'` aqui — o @supabase/ssr crava
  // `flowType: "pkce"` DEPOIS de espalhar as opções recebidas (ver
  // node_modules/@supabase/ssr/dist/main/createBrowserClient.js), então a opção é
  // descartada em silêncio. Como o PKCE exige o code_verifier no MESMO navegador que
  // pediu o reset, o link do e-mail falha quando é aberto no navegador interno do Gmail.
  // Por isso a recuperação de senha usa código de 6 dígitos (verifyOtp), que não
  // depende de navegador — ver app/(auth)/redefinir-senha/page.tsx.
}
