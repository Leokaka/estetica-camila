# Guia de Deploy — Estética Camila

## Passo 1 — Configurar o Supabase

### 1.1 Criar o projeto
1. Acesse [supabase.com](https://supabase.com) e faça login
2. Clique em **New Project**
3. Nome: `estetica-camila` | Senha: crie uma forte e guarde
4. Aguarde o projeto ser criado (~1 min)

### 1.2 Criar as tabelas
1. No painel do Supabase, clique em **SQL Editor** no menu lateral
2. Clique em **New query**
3. Abra o arquivo `supabase-schema.sql` desta pasta e cole todo o conteúdo
4. Clique em **Run** (botão verde)
5. Você verá as tabelas criadas em **Table Editor**

### 1.3 Criar usuários (você e Camila)
1. Vá em **Authentication > Users**
2. Clique em **Add user > Create new user**
3. Crie para você: `leokaka59@gmail.com` + senha
4. Crie para a Camila: email dela + senha
5. Marque **Auto Confirm User** para ambos

### 1.4 Pegar as chaves da API
1. Vá em **Project Settings > API**
2. Copie:
   - **Project URL** → vai para `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → vai para `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Passo 2 — Fazer o deploy no Vercel

### 2.1 Subir o código para o GitHub
Abra o terminal nesta pasta e execute:

```bash
git init
git add .
git commit -m "feat: sistema estética camila"
```

Depois:
1. Acesse [github.com](https://github.com) e crie um **New repository** chamado `estetica-camila`
2. Siga as instruções da tela para conectar e fazer o push

### 2.2 Conectar ao Vercel
1. Acesse [vercel.com](https://vercel.com) e faça login com o GitHub
2. Clique em **Add New > Project**
3. Selecione o repositório `estetica-camila`
4. Clique em **Deploy** (sem mudar nada por enquanto)

### 2.3 Configurar as variáveis de ambiente no Vercel
1. Após o deploy, vá em **Settings > Environment Variables**
2. Adicione as duas variáveis:

| Nome | Valor |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` (copiado do Supabase) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (copiado do Supabase) |

3. Clique em **Save**
4. Vá em **Deployments** e clique em **Redeploy** no último deploy

### 2.4 Testar
1. Acesse a URL gerada pelo Vercel (ex: `estetica-camila.vercel.app`)
2. Faça login com o usuário criado no Supabase
3. Tudo funcionando!

---

## Passo 3 — Testar localmente (opcional)

Atualize o arquivo `.env.local` com as chaves reais do Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Depois rode:

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

---

## Dúvidas frequentes

**O sistema não loga?**
→ Verifique se o usuário foi criado em Authentication > Users no Supabase e se as chaves no Vercel estão corretas.

**Os dados não aparecem?**
→ Verifique se o SQL do schema foi executado corretamente no Supabase SQL Editor.

**Quero atualizar o sistema?**
→ Faça as alterações no código, rode `git add . && git commit -m "..." && git push`. O Vercel faz o novo deploy automaticamente.
