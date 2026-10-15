-- =============================================
-- AJUSTES DE CADASTRO DE SERVIÇOS — 15/10/2026
-- Rode no SQL Editor do Supabase. Só corrige dois serviços; não apaga nada,
-- não mexe em agendamento nem em financeiro. Cada UPDATE só age se o valor
-- ainda for o errado, então rodar duas vezes não faz mal.
-- =============================================

-- Hidrolipo: a Camila cadastrou em 06/10 e o campo de retorno ficou vazio, então
-- ela nunca entra no card "Na hora de voltar". É tratamento em sessões, no mesmo
-- ritmo do resto do corporal (12 dias). Se o protocolo dela for outro, ela ajusta
-- na tela de Serviços.
UPDATE servicos SET dias_retorno = 12
WHERE nome ILIKE 'hidrolipo%' AND dias_retorno IS NULL;

-- Remoção de verruga é feita com o jato de plasma, mas estava em "Corporal" com
-- retorno de 12 dias — a cliente apareceria pra voltar antes de a pele cicatrizar.
UPDATE servicos SET categoria = 'Plasma', dias_retorno = 45
WHERE nome ILIKE 'remoção de verruga%' AND categoria = 'Corporal';

-- Confira:
-- SELECT nome, categoria, dias_retorno FROM servicos WHERE nome ILIKE 'hidrolipo%' OR nome ILIKE 'remoção de verruga%';
