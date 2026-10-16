-- =============================================
-- NOVOS PREÇOS — definidos pela Camila em 16/10/2026
-- Rode no SQL Editor do Supabase. Só muda o preço de tabela de 6 serviços.
--
-- O que NÃO muda (de propósito): agendamentos já marcados guardam o próprio
-- valor_cobrado, então quem já tinha horário continua com o preço combinado.
-- O preço novo vale a partir do próximo agendamento criado.
--
-- Cada UPDATE casa pelo nome exato (sem diferenciar maiúscula/acento) e só nos
-- serviços ativos, pra não mexer em cadastro antigo desativado.
-- =============================================

UPDATE servicos SET preco = 90  WHERE ativo AND lower(nome) = lower('Massagem Modeladora');
UPDATE servicos SET preco = 100 WHERE ativo AND lower(nome) = lower('Drenagem Linfática');
UPDATE servicos SET preco = 100 WHERE ativo AND lower(nome) = lower('Massagem Relaxante');
UPDATE servicos SET preco = 150 WHERE ativo AND lower(nome) = lower('Limpeza de Pele');
UPDATE servicos SET preco = 230 WHERE ativo AND lower(nome) = lower('Microagulhamento');
UPDATE servicos SET preco = 180 WHERE ativo AND lower(nome) = lower('Peeling');

-- Confira: devem aparecer as 6 linhas com o preço novo.
SELECT nome, preco FROM servicos
WHERE ativo AND lower(nome) IN (
  'massagem modeladora', 'drenagem linfática', 'massagem relaxante',
  'limpeza de pele', 'microagulhamento', 'peeling'
)
ORDER BY nome;
