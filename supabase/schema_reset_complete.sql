-- =============================================================================
-- FrotaMaq — RESET COMPLETO DO BANCO DE DADOS
-- =============================================================================
-- ATENÇÃO: Este script APAGA todas as tabelas e dados existentes.
-- Execute INTEIRO no SQL Editor do Supabase (projeto FrotaMaq).
--
-- PRÉ-REQUISITO: Crie os usuários em Authentication → Users (senha: 123456):
--   admin@frotamaq.com
--   gestor1@frotamaq.com
--   mecanico1@frotamaq.com
--   motorista1@frotamaq.com
-- =============================================================================

BEGIN;

-- =============================================================================
-- 0. REMOVER ESTRUTURA ANTIGA
-- =============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trg_atualizar_status_veiculo ON public.manutencoes;

DROP TABLE IF EXISTS public.alertas CASCADE;
DROP TABLE IF EXISTS public.manutencoes CASCADE;
DROP TABLE IF EXISTS public.veiculos CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.empresas CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.atualizar_status_veiculo() CASCADE;
DROP FUNCTION IF EXISTS public.gerar_alertas_manutencao() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_perfil() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_empresa_id() CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;

DROP TYPE IF EXISTS public.status_alerta CASCADE;
DROP TYPE IF EXISTS public.tipo_alerta CASCADE;
DROP TYPE IF EXISTS public.status_manutencao CASCADE;
DROP TYPE IF EXISTS public.tipo_manutencao CASCADE;
DROP TYPE IF EXISTS public.status_veiculo CASCADE;
DROP TYPE IF EXISTS public.perfil_usuario CASCADE;

-- =============================================================================
-- 1. TABELAS
-- =============================================================================

CREATE TABLE public.empresas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  cnpj        TEXT,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "profiles" do domínio = tabela usuarios (nome usado pelo app React)
CREATE TABLE public.usuarios (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  perfil      TEXT NOT NULL CHECK (
    perfil IN ('super_admin', 'gestor', 'gerente', 'mecanico', 'motorista')
  ),
  empresa_id  UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_empresa_obrigatoria CHECK (
    perfil = 'super_admin' OR empresa_id IS NOT NULL
  )
);

CREATE VIEW public.profiles AS
SELECT id, nome, email, perfil, empresa_id, created_at
FROM public.usuarios;

CREATE TABLE public.veiculos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- identificador = placa ou prefixo da frota
  placa           TEXT NOT NULL,
  identificador   TEXT GENERATED ALWAYS AS (placa) STORED,
  marca           TEXT NOT NULL,
  modelo          TEXT NOT NULL,
  ano             INTEGER CHECK (ano IS NULL OR (ano >= 1900 AND ano <= 2100)),
  tipo_veiculo    TEXT CHECK (
    tipo_veiculo IS NULL OR tipo_veiculo IN ('caminhao', 'maquina_amarela', 'utilitario', 'trator', 'outro')
  ),
  tipo_medicao    TEXT NOT NULL DEFAULT 'km' CHECK (tipo_medicao IN ('km', 'horimetro')),
  km_atual        NUMERIC NOT NULL DEFAULT 0 CHECK (km_atual >= 0),
  medicao_atual   NUMERIC GENERATED ALWAYS AS (km_atual) STORED,
  status          TEXT NOT NULL DEFAULT 'em_operacao' CHECK (
    status IN (
      'em_operacao',      -- disponível / em uso (app)
      'em_manutencao',
      'fora_de_operacao', -- inativo
      'disponivel', 'em_uso', 'inativo' -- aliases legíveis
    )
  ),
  foto_url        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, placa)
);

CREATE TABLE public.manutencoes (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id                  UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  tipo                        TEXT NOT NULL CHECK (tipo IN ('preventiva', 'corretiva', 'preditiva')),
  status                      TEXT NOT NULL DEFAULT 'agendada' CHECK (
    status IN ('agendada', 'pendente', 'em_andamento', 'concluida', 'cancelada', 'atrasada')
  ),
  descricao                   TEXT NOT NULL,
  valor                       NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  local                       TEXT,
  metodo_pagamento            TEXT CHECK (
    metodo_pagamento IN ('cartao', 'pix', 'boleto', 'faturado', 'dinheiro', 'transferencia', 'PIX', 'Cartao', 'Boleto', 'Faturado')
  ),
  responsavel                 TEXT,
  data_hora                   TIMESTAMPTZ NOT NULL,
  data_manutencao             DATE GENERATED ALWAYS AS ((data_hora AT TIME ZONE 'UTC')::date) STORED,
  proxima_manutencao_previsao TEXT,
  proxima_manutencao_data     DATE,
  proxima_manutencao_km       NUMERIC,
  proxima_manutencao_medicao  NUMERIC GENERATED ALWAYS AS (proxima_manutencao_km) STORED,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.alertas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id       UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL CHECK (tipo IN ('vencida', 'proxima')),
  mensagem         TEXT NOT NULL,
  data_vencimento  DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'resolvido')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. ÍNDICES
-- =============================================================================
CREATE INDEX idx_empresas_slug ON public.empresas(slug);
CREATE INDEX idx_usuarios_empresa ON public.usuarios(empresa_id);
CREATE INDEX idx_usuarios_perfil ON public.usuarios(perfil);
CREATE INDEX idx_veiculos_empresa ON public.veiculos(empresa_id);
CREATE INDEX idx_veiculos_status ON public.veiculos(status);
CREATE INDEX idx_veiculos_placa ON public.veiculos(placa);
CREATE INDEX idx_manutencoes_empresa ON public.manutencoes(empresa_id);
CREATE INDEX idx_manutencoes_veiculo ON public.manutencoes(veiculo_id);
CREATE INDEX idx_manutencoes_data ON public.manutencoes(data_hora);
CREATE INDEX idx_manutencoes_status ON public.manutencoes(status);
CREATE INDEX idx_alertas_empresa ON public.alertas(empresa_id);
CREATE INDEX idx_alertas_veiculo ON public.alertas(veiculo_id);

-- =============================================================================
-- 3. FUNÇÕES AUXILIARES
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_perfil()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT perfil FROM public.usuarios WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.usuarios WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_perfil() = 'super_admin';
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nome, perfil, empresa_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'perfil', 'motorista'),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'empresa_id'), '')::uuid
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_status_veiculo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.veiculos
    SET status = 'em_operacao'
    WHERE id = NEW.veiculo_id;
  ELSIF NEW.status = 'em_andamento' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.veiculos
    SET status = 'em_manutencao'
    WHERE id = NEW.veiculo_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_atualizar_status_veiculo
  AFTER UPDATE OF status ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_status_veiculo();

-- =============================================================================
-- 4. ROW LEVEL SECURITY (desenvolvimento / testes — permissivo)
-- =============================================================================
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

-- Empresas
CREATE POLICY "dev_empresas_select" ON public.empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev_empresas_insert" ON public.empresas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dev_empresas_update" ON public.empresas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "dev_empresas_delete" ON public.empresas FOR DELETE TO authenticated USING (true);

-- Usuarios / profiles
CREATE POLICY "dev_usuarios_select" ON public.usuarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev_usuarios_insert" ON public.usuarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dev_usuarios_update" ON public.usuarios FOR UPDATE TO authenticated USING (true);
CREATE POLICY "dev_usuarios_delete" ON public.usuarios FOR DELETE TO authenticated USING (true);

-- Veículos
CREATE POLICY "dev_veiculos_select" ON public.veiculos FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev_veiculos_insert" ON public.veiculos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dev_veiculos_update" ON public.veiculos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "dev_veiculos_delete" ON public.veiculos FOR DELETE TO authenticated USING (true);

-- Manutenções
CREATE POLICY "dev_manutencoes_select" ON public.manutencoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev_manutencoes_insert" ON public.manutencoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dev_manutencoes_update" ON public.manutencoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "dev_manutencoes_delete" ON public.manutencoes FOR DELETE TO authenticated USING (true);

-- Alertas
CREATE POLICY "dev_alertas_select" ON public.alertas FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev_alertas_insert" ON public.alertas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dev_alertas_update" ON public.alertas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "dev_alertas_delete" ON public.alertas FOR DELETE TO authenticated USING (true);

-- =============================================================================
-- 5. SEED — EMPRESAS (IDs fixos)
-- =============================================================================
INSERT INTO public.empresas (id, nome, cnpj, slug)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Empresa 1 - Logística & Frota',
    '11.111.111/0001-11',
    'empresa-1'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Empresa 2 - Máquinas & Construção',
    '22.222.222/0001-22',
    'empresa-2'
  );

-- =============================================================================
-- 6. SEED — PERFIS DE USUÁRIO (requer auth.users criados)
-- =============================================================================
INSERT INTO public.usuarios (id, email, nome, perfil, empresa_id)
SELECT u.id, u.email, 'Admin Global', 'super_admin', NULL
FROM auth.users u WHERE u.email = 'admin@frotamaq.com'
ON CONFLICT (id) DO UPDATE SET
  perfil = 'super_admin', empresa_id = NULL, nome = 'Admin Global';

INSERT INTO public.usuarios (id, email, nome, perfil, empresa_id)
SELECT u.id, u.email, 'Gestor Empresa 1', 'gestor', '11111111-1111-1111-1111-111111111111'::uuid
FROM auth.users u WHERE u.email = 'gestor1@frotamaq.com'
ON CONFLICT (id) DO UPDATE SET
  perfil = 'gestor', empresa_id = '11111111-1111-1111-1111-111111111111'::uuid, nome = 'Gestor Empresa 1';

INSERT INTO public.usuarios (id, email, nome, perfil, empresa_id)
SELECT u.id, u.email, 'Mecânico Empresa 1', 'mecanico', '11111111-1111-1111-1111-111111111111'::uuid
FROM auth.users u WHERE u.email = 'mecanico1@frotamaq.com'
ON CONFLICT (id) DO UPDATE SET
  perfil = 'mecanico', empresa_id = '11111111-1111-1111-1111-111111111111'::uuid, nome = 'Mecânico Empresa 1';

INSERT INTO public.usuarios (id, email, nome, perfil, empresa_id)
SELECT u.id, u.email, 'Motorista Empresa 1', 'motorista', '11111111-1111-1111-1111-111111111111'::uuid
FROM auth.users u WHERE u.email = 'motorista1@frotamaq.com'
ON CONFLICT (id) DO UPDATE SET
  perfil = 'motorista', empresa_id = '11111111-1111-1111-1111-111111111111'::uuid, nome = 'Motorista Empresa 1';

-- =============================================================================
-- 7. SEED — VEÍCULOS
-- =============================================================================
INSERT INTO public.veiculos (
  id, empresa_id, placa, marca, modelo, ano, tipo_veiculo, tipo_medicao, km_atual, status
) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'E1-CAM01', 'Volvo', 'FH 540', 2022, 'caminhao', 'km', 185000, 'em_operacao'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11111111-1111-1111-1111-111111111111', 'E1-UTI01', 'Toyota', 'Hilux SRX', 2023, 'utilitario', 'km', 45000, 'em_operacao'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '11111111-1111-1111-1111-111111111111', 'E1-CAM02', 'Scania', 'R450', 2021, 'caminhao', 'km', 220000, 'em_manutencao'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '22222222-2222-2222-2222-222222222222', 'E2-ESC01', 'Caterpillar', '320 GC', 2021, 'maquina_amarela', 'horimetro', 4200, 'em_operacao'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '22222222-2222-2222-2222-222222222222', 'E2-TRT01', 'John Deere', '6110J', 2023, 'trator', 'horimetro', 890, 'em_operacao'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '22222222-2222-2222-2222-222222222222', 'E2-CAM01', 'Mercedes-Benz', 'Actros 2651', 2020, 'caminhao', 'km', 310000, 'fora_de_operacao');

-- =============================================================================
-- 8. SEED — MANUTENÇÕES (concluídas, próximas, vencidas)
-- =============================================================================
INSERT INTO public.manutencoes (
  empresa_id, veiculo_id, tipo, status, descricao, valor, local, metodo_pagamento,
  responsavel, data_hora, proxima_manutencao_previsao, proxima_manutencao_data, proxima_manutencao_km
) VALUES
  -- Empresa 1: concluídas (custos do mês + histórico)
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'preventiva', 'concluida',
   'Troca de óleo e filtros', 3500.00, 'Oficina Central', 'pix', 'João Mecânico',
   (now() - interval '10 days'), 'Próxima troca em 10.000 km ou 6 meses', (current_date + interval '180 days')::date, 195000),

  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'corretiva', 'concluida',
   'Troca de pastilhas de freio', 1200.00, 'Auto Center Sul', 'cartao', 'Carlos Silva',
   (now() - interval '5 days'), 'Revisão freios em 5.000 km', (current_date + interval '90 days')::date, 50000),

  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'preditiva', 'concluida',
   'Diagnóstico eletrônico', 850.00, 'Concessionária Premium', 'faturado', 'Ana Técnica',
   (now() - interval '30 days'), 'Inspeção preditiva em 15.000 km', (current_date + interval '120 days')::date, 200000),

  -- Empresa 1: próximas (laranja)
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'preventiva', 'agendada',
   'Revisão programada 10.000 km', 0, 'Oficina Central', NULL, 'João Mecânico',
   (now() + interval '5 days'), 'Revisão semestral', (current_date + interval '5 days')::date, 46000),

  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'corretiva', 'agendada',
   'Reparo suspensão', 0, 'Mecânica Pesada Norte', NULL, 'Pedro Hidráulica',
   (now() + interval '15 days'), NULL, (current_date + interval '15 days')::date, NULL),

  -- Empresa 1: vencidas (vermelho)
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'preventiva', 'agendada',
   'Troca correia dentada — VENCIDA', 0, 'Oficina Central', NULL, 'Marcos Diesel',
   (now() - interval '12 days'), 'Urgente — atrasada', (current_date - interval '12 days')::date, 221000),

  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'corretiva', 'em_andamento',
   'Manutenção em andamento na oficina', 4500.00, 'Mecânica Pesada Norte', 'boleto', 'Pedro Hidráulica',
   (now() - interval '3 days'), NULL, NULL, NULL),

  -- Empresa 2: mix de status
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'preventiva', 'concluida',
   'Manutenção sistema hidráulico', 8500.00, 'Hidráulica Industrial', 'faturado', 'Pedro Hidráulica',
   (now() - interval '7 days'), 'Revisão hidráulica em 500 h', (current_date + interval '60 days')::date, 4700),

  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'preventiva', 'concluida',
   'Troca filtros e lubrificação', 650.00, 'Oficina Rural', 'pix', 'Ricardo Motorista',
   (now() - interval '20 days'), 'Próxima em 200 h', (current_date + interval '90 days')::date, 1090),

  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'preditiva', 'agendada',
   'Inspeção preditiva sensores', 0, 'Concessionária Premium', NULL, 'Fernanda Preditiva',
   (now() + interval '25 days'), NULL, (current_date + interval '25 days')::date, NULL),

  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'corretiva', 'agendada',
   'Revisão motor diesel — VENCIDA', 0, 'Mecânica Pesada Norte', NULL, 'Marcos Diesel',
   (now() - interval '20 days'), 'Motor com falha reportada', (current_date - interval '20 days')::date, 311000);

-- =============================================================================
-- 9. SEED — ALERTAS
-- =============================================================================
INSERT INTO public.alertas (empresa_id, veiculo_id, tipo, mensagem, data_vencimento, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'vencida',
   'Manutenção vencida: Troca correia dentada', (current_date - interval '12 days')::date, 'ativo'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'proxima',
   'Revisão programada em 5 dias', (current_date + interval '5 days')::date, 'ativo'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'vencida',
   'Manutenção vencida: Revisão motor diesel', (current_date - interval '20 days')::date, 'ativo');

COMMIT;

-- =============================================================================
-- 10. VERIFICAÇÃO
-- =============================================================================
SELECT 'empresas' AS tabela, count(*) AS total FROM public.empresas
UNION ALL SELECT 'usuarios', count(*) FROM public.usuarios
UNION ALL SELECT 'veiculos', count(*) FROM public.veiculos
UNION ALL SELECT 'manutencoes', count(*) FROM public.manutencoes
UNION ALL SELECT 'alertas', count(*) FROM public.alertas;

SELECT e.nome AS empresa, u.email, u.perfil
FROM public.usuarios u
LEFT JOIN public.empresas e ON e.id = u.empresa_id
ORDER BY u.email;
