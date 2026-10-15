-- =============================================
-- COMO A CLIENTE CHEGOU — 15/10/2026
-- Rode este bloco inteiro no SQL Editor do Supabase. É aditivo: só acrescenta
-- duas colunas em clientes. Nenhum dado existente é alterado; as 39 clientes já
-- cadastradas ficam com os dois campos vazios.
--
-- Por que existe: o faturamento está travado em ~R$ 3.000/mês com a agenda
-- ocupada uns 30% do tempo — o gargalo é cliente nova, não operação. Só que hoje
-- não se sabe de onde nenhuma cliente veio, então não dá pra saber se vale mais
-- investir em Instagram, Google ou em programa de indicação. E indicação, que num
-- espaço de bairro costuma ser o canal principal, só funciona se der pra saber
-- QUEM indicou, pra ela agradecer (e recompensar, se decidir fazer isso).
--
-- O app já funciona sem estas colunas: o campo aparece, mas só é gravado depois
-- que este SQL rodar.
-- =============================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS origem TEXT
  CHECK (origem IN ('indicacao', 'instagram', 'google', 'passou_na_frente', 'outro'));

-- ON DELETE SET NULL: se a cliente que indicou for excluída, a indicada continua
-- existindo — só perde o vínculo.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS indicada_por UUID
  REFERENCES clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_indicada_por ON clientes (indicada_por);

COMMENT ON COLUMN clientes.origem IS 'Como a cliente conheceu a Camila. NULL = não informado (inclui todas as cadastradas antes de 15/10/2026).';
COMMENT ON COLUMN clientes.indicada_por IS 'Cliente que indicou, quando origem = indicacao.';
