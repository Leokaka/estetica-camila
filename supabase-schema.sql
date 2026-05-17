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
CREATE TABLE IF NOT EXISTS agendamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES servicos(id) ON DELETE RESTRICT,
  data_hora TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado','confirmado','realizado','cancelado')),
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
CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos(data);
CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo ON lancamentos(tipo);

-- RLS (Row Level Security) - simplificado para usuário autenticado ver tudo
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso autenticado - clientes" ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso autenticado - servicos" ON servicos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso autenticado - agendamentos" ON agendamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso autenticado - lancamentos" ON lancamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Dados iniciais de serviços para começar
INSERT INTO servicos (nome, descricao, preco, custo, duracao_minutos, categoria) VALUES
('Limpeza de Pele', 'Limpeza facial profunda', 120.00, 30.00, 90, 'Facial'),
('Design de Sobrancelha', 'Modelagem e design de sobrancelha', 45.00, 8.00, 30, 'Sobrancelha'),
('Hidratação Facial', 'Hidratação profunda com máscara', 80.00, 20.00, 60, 'Facial'),
('Depilação Buço', 'Depilação da região do buço', 25.00, 5.00, 15, 'Depilação'),
('Depilação Axila', 'Depilação das axilas', 30.00, 5.00, 20, 'Depilação'),
('Micropigmentação Sobrancelha', 'Micropigmentação de sobrancelha', 400.00, 80.00, 120, 'Micropigmentação')
ON CONFLICT DO NOTHING;
