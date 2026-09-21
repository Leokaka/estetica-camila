-- =============================================
-- EVENTOS DA PÁGINA PÚBLICA (/agende)
-- Rode este bloco inteiro no SQL Editor do Supabase. É aditivo: não mexe em
-- nenhuma tabela existente.
--
-- Pra que serve: medir se o marketing está funcionando. Hoje não existe nenhum
-- número entre "a pessoa viu o anúncio" e "a Camila recebeu mensagem" — quando
-- os anúncios pagos começarem, sem isso a gente estaria comprando clique no escuro.
-- =============================================

CREATE TABLE IF NOT EXISTS eventos (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 'visita' = abriu a /agende. Os outros = clicou no botão correspondente.
  tipo         TEXT NOT NULL CHECK (tipo IN ('visita', 'whatsapp', 'instagram', 'maps')),
  -- de onde a pessoa veio: vem do ?origem= da URL (instagram, google, plasma...).
  -- NULL quando o link não estava marcado — aparece como "direto" no painel.
  origem       TEXT,
  caminho      TEXT,
  -- só o domínio de quem indicou (ex.: "instagram.com"), nunca a URL inteira
  referencia   TEXT,
  dispositivo  TEXT CHECK (dispositivo IN ('celular', 'computador')),
  -- id aleatório por aba, guardado só na sessão do navegador. Serve pra ligar
  -- a visita ao clique da MESMA pessoa. Não identifica ninguém e some ao fechar.
  sessao       TEXT
);

CREATE INDEX IF NOT EXISTS idx_eventos_criado_em ON eventos (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo_data ON eventos (tipo, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_origem ON eventos (origem);

ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;

-- Quem já está logado no sistema (a Camila e o Léo) lê tudo.
DROP POLICY IF EXISTS "eventos: leitura autenticada" ON eventos;
CREATE POLICY "eventos: leitura autenticada"
  ON eventos FOR SELECT TO authenticated USING (true);

-- De propósito NÃO existe policy de INSERT: nem a chave anônima (que é pública,
-- vai no bundle do site) consegue gravar aqui. Quem grava é só a rota
-- /api/evento no servidor, usando a service role, que ignora RLS. Assim ninguém
-- de fora consegue poluir o número — se o dado vai orientar gasto com anúncio,
-- ele precisa ser confiável.
