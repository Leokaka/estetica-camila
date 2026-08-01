-- =============================================
-- SCHEMA COMPLETO - ESTÉTICA CAMILA
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  data_nascimento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de serviços
CREATE TABLE IF NOT EXISTS servicos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco DECIMAL(10,2) NOT NULL DEFAULT 0,
  custo DECIMAL(10,2) NOT NULL DEFAULT 0,
  duracao_minutos INTEGER NOT NULL DEFAULT 60,
  categoria TEXT NOT NULL DEFAULT 'Geral',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de agendamentos
-- local: 'quartinho' = 100% da Camila | 'karine' = 60% da Camila
CREATE TABLE IF NOT EXISTS agendamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES servicos(id) ON DELETE RESTRICT,
  data_hora TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado','confirmado','realizado','cancelado')),
  local TEXT NOT NULL DEFAULT 'quartinho' CHECK (local IN ('quartinho','karine')),
  valor_cobrado DECIMAL(10,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de lançamentos financeiros
CREATE TABLE IF NOT EXISTS lancamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  descricao TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  categoria TEXT NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  agendamento_id UUID REFERENCES agendamentos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_hora);
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente ON agendamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_local ON agendamentos(local);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos(data);
CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo ON lancamentos(tipo);

-- RLS (Row Level Security)
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso autenticado - clientes" ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso autenticado - servicos" ON servicos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso autenticado - agendamentos" ON agendamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso autenticado - lancamentos" ON lancamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- SERVIÇOS DA CAMILA GARCIA
-- Preços e durações reais conforme entrevista
-- =============================================
INSERT INTO servicos (nome, descricao, preco, custo, duracao_minutos, categoria) VALUES
-- Facial (Quartinho)
('Limpeza de Pele', 'Limpeza facial profunda e personalizada', 120.00, 25.00, 75, 'Facial'),
('Microagulhamento', 'Trata estria, manchas de acne, colágeno, textura da pele', 95.00, 23.00, 40, 'Facial'),
('Combo Limpeza + Microagulhamento', 'Limpeza de pele + microagulhamento no mesmo dia', 190.00, 45.00, 120, 'Facial'),

-- Plasma (Quartinho)
('Jato de Plasma', 'Remoção de verrugas, manchas, melanose solar, lifting facial, olheiras', 150.00, 20.00, 50, 'Plasma'),

-- Cílios (Quartinho e Karine)
('Cílios Fio a Fio — Colocação', 'Aplicação completa de cílios fio a fio', 130.00, 30.00, 120, 'Cílios'),
('Cílios Fio a Fio — Manutenção', 'Manutenção dos cílios', 90.00, 15.00, 60, 'Cílios'),

-- Sobrancelha (Karine principalmente)
('Design de Sobrancelha', 'Modelagem e design de sobrancelha', 30.00, 5.00, 30, 'Sobrancelha'),
('Design de Sobrancelha com Henna', 'Design + coloração com henna', 50.00, 10.00, 40, 'Sobrancelha'),
('Micropigmentação de Sobrancelha', 'Micropigmentação semi-permanente', 400.00, 80.00, 120, 'Micropigmentação'),

-- Corporal (Quartinho)
('Massagem Modeladora', 'Massagem modeladora com placas de contração abdominal', 90.00, 15.00, 60, 'Corporal'),
('Drenagem Linfática', 'Drenagem linfática manual', 80.00, 12.00, 60, 'Corporal'),
('Massagem Relaxante', 'Massagem relaxante completa', 90.00, 15.00, 60, 'Corporal'),

-- Pacotes (5 sessões)
('Pacote Massagem Modeladora 5x', '5 sessões de massagem modeladora', 375.00, 65.00, 60, 'Corporal'),
('Pacote Drenagem Linfática 5x', '5 sessões de drenagem linfática', 350.00, 55.00, 60, 'Corporal'),
('Pacote Massagem Relaxante 5x', '5 sessões de massagem relaxante', 375.00, 65.00, 60, 'Corporal')
ON CONFLICT DO NOTHING;

-- =============================================
-- MIGRAÇÃO: adicionar coluna 'local' se já existir a tabela
-- Execute apenas se a tabela já existia antes
-- =============================================
-- ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS local TEXT NOT NULL DEFAULT 'quartinho' CHECK (local IN ('quartinho','karine'));
-- CREATE INDEX IF NOT EXISTS idx_agendamentos_local ON agendamentos(local);

-- =============================================
-- MIGRAÇÃO 25/07/2026: controle de pagamento por agendamento
-- Rode esse bloco no SQL Editor do Supabase (aditivo — não mexe em dado existente,
-- linhas já cadastradas ficam com status_pagamento = 'pendente' até serem atualizadas)
-- =============================================
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS forma_pagamento TEXT
  CHECK (forma_pagamento IN ('pix','dinheiro','cartao_debito','cartao_credito','transferencia'));
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS status_pagamento TEXT NOT NULL DEFAULT 'pendente'
  CHECK (status_pagamento IN ('pago','parcial','pendente'));
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS valor_pago DECIMAL(10,2);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS data_prevista_pagamento DATE;
