-- =============================================
-- JANELA DE RETORNO POR PROCEDIMENTO
-- Rode este bloco inteiro no SQL Editor do Supabase. É aditivo: só acrescenta
-- duas colunas e preenche valores iniciais. Nenhum dado existente é alterado.
--
-- Por que existe: o card "Clientes sem Retorno" usava 60 dias pra tudo. Só que
-- cada procedimento tem seu próprio ritmo — cílios pedem manutenção em ~3 semanas,
-- limpeza de pele em ~5, massagem em pacote é semanal. Com régua única de 60 dias,
-- a cliente de cílios só aparecia no alerta quando já tinha passado por duas
-- manutenções em outro lugar. O alerta chegava depois da perda, não antes.
-- =============================================

-- Quantos dias, depois do atendimento, faz sentido a cliente voltar.
-- NULL = procedimento sem retorno esperado (não entra no alerta).
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS dias_retorno INTEGER;

COMMENT ON COLUMN servicos.dias_retorno IS
  'Dias até a cliente precisar repetir esse procedimento. Alimenta o card "Na hora de voltar" no painel.';

-- Quando a Camila mandou a última mensagem de retorno pra essa cliente. Serve pra
-- ela não reaparecer no alerta logo depois de já ter sido chamada — sem isso a
-- lista mostra os mesmos nomes todo dia e ela para de olhar.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contato_retorno_em TIMESTAMPTZ;

-- -----------------------------------------------------------------
-- Valores iniciais. São PONTO DE PARTIDA do ritmo usual de cada
-- procedimento, não regra: a Camila ajusta na tela de Serviços.
-- O casamento é por nome (ILIKE) porque os nomes cadastrados mudaram
-- desde o schema original; o que sobrar sem valor cai no bloco por
-- categoria logo abaixo.
-- -----------------------------------------------------------------

-- Extensão de cílios: o fio cresce e cai junto com o natural. Passou de 3 semanas,
-- o volume já abriu — é o procedimento com a janela mais curta e mais fácil de perder.
UPDATE servicos SET dias_retorno = 21
  WHERE dias_retorno IS NULL AND (
    nome ILIKE '%volume%' OR nome ILIKE '%fox%' OR nome ILIKE '%fio a fio%'
    OR nome ILIKE '%manutenção%' OR nome ILIKE '%manutencao%'
  );

-- Lash lifting e brow lamination trabalham o pelo natural: duram um ciclo inteiro.
UPDATE servicos SET dias_retorno = 45
  WHERE dias_retorno IS NULL AND (nome ILIKE '%lash%' OR nome ILIKE '%lamination%' OR nome ILIKE '%brow%');

UPDATE servicos SET dias_retorno = 25
  WHERE dias_retorno IS NULL AND nome ILIKE '%sobrancelha%' AND nome NOT ILIKE '%micropigment%';

-- Micropigmentação: só o retoque, bem depois.
UPDATE servicos SET dias_retorno = 300
  WHERE dias_retorno IS NULL AND nome ILIKE '%micropigment%';

UPDATE servicos SET dias_retorno = 35 WHERE dias_retorno IS NULL AND nome ILIKE '%limpeza%';
UPDATE servicos SET dias_retorno = 30 WHERE dias_retorno IS NULL AND nome ILIKE '%peeling%';
UPDATE servicos SET dias_retorno = 30 WHERE dias_retorno IS NULL AND nome ILIKE '%microagulha%';

-- Jato de plasma: tempo de cicatrizar antes de avaliar nova sessão.
UPDATE servicos SET dias_retorno = 45 WHERE dias_retorno IS NULL AND nome ILIKE '%plasma%';

-- Massagem e drenagem só dão resultado em sequência — a janela é quase semanal,
-- e é onde a cliente some no meio do caminho sem ninguém perceber.
UPDATE servicos SET dias_retorno = 12
  WHERE dias_retorno IS NULL AND (
    nome ILIKE '%massagem%' OR nome ILIKE '%drenagem%' OR nome ILIKE '%modeladora%'
    OR nome ILIKE '%relaxante%' OR nome ILIKE '%pacote%'
  );

-- Rede de segurança por categoria, pra qualquer serviço cadastrado depois.
UPDATE servicos SET dias_retorno = CASE categoria
  WHEN 'Cílios' THEN 21
  WHEN 'Sobrancelha' THEN 25
  WHEN 'Corporal' THEN 12
  WHEN 'Facial' THEN 35
  WHEN 'Plasma' THEN 45
  WHEN 'Micropigmentação' THEN 300
  ELSE 40
END
WHERE dias_retorno IS NULL;

-- Confira o resultado antes de fechar:
-- SELECT nome, categoria, dias_retorno FROM servicos WHERE ativo ORDER BY dias_retorno;
