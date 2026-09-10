-- ============================================================
-- FrotaMaq — fix_database.sql
-- Execute INTEIRO no SQL Editor do Supabase Dashboard
-- Repara tabelas, funcoes, triggers, RLS e policies permissivas
-- ============================================================
--
-- TABELAS NECESSARIAS PELO APP:
--   usuarios    -> perfil apos login (AuthContext.fetchProfile)
--   veiculos    -> listagem e CRUD de frota
--   manutencoes -> historico e formularios de manutencao
--   alertas     -> dashboard e tela de alertas
--
-- LOGIN usa Supabase Auth (auth.users) — nao precisa de tabela public
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================
DO $enum$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'perfil_usuario') THEN
    CREATE TYPE public.perfil_usuario AS ENUM ('gerente', 'mecanico', 'motorista');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_veiculo') THEN
    CREATE TYPE public.status_veiculo AS ENUM ('em_operacao', 'em_manutencao', 'fora_de_operacao');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_manutencao') THEN
    CREATE TYPE public.tipo_manutencao AS ENUM ('preventiva', 'corretiva', 'preditiva');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_manutencao') THEN
    CREATE TYPE public.status_manutencao AS ENUM ('agendada', 'em_andamento', 'concluida', 'cancelada');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_alerta') THEN
    CREATE TYPE public.tipo_alerta AS ENUM ('vencida', 'proxima');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_alerta') THEN
    CREATE TYPE public.status_alerta AS ENUM ('ativo', 'resolvido');
  END IF;
END;
$enum$;

-- super_admin (enum existente com 3 valores — rodar em query separada se falhar aqui)
DO $add_super$
BEGIN
  ALTER TYPE public.perfil_usuario ADD VALUE 'super_admin';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$add_super$;

-- ============================================================
-- 2. TABELAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  perfil public.perfil_usuario NOT NULL DEFAULT 'motorista',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placa TEXT NOT NULL UNIQUE,
  modelo TEXT NOT NULL,
  marca TEXT NOT NULL,
  ano INT NOT NULL CHECK (ano >= 1900 AND ano <= 2100),
  km_atual INT NOT NULL DEFAULT 0 CHECK (km_atual >= 0),
  status public.status_veiculo NOT NULL DEFAULT 'em_operacao',
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.manutencoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  tipo public.tipo_manutencao NOT NULL,
  descricao TEXT NOT NULL,
  data_hora TIMESTAMPTZ NOT NULL,
  local TEXT,
  responsavel TEXT,
  valor DECIMAL(10, 2) DEFAULT 0,
  metodo_pagamento TEXT CHECK (
    metodo_pagamento IN ('cartao', 'pix', 'boleto', 'faturado', 'dinheiro', 'transferencia')
  ),
  proxima_manutencao_previsao TEXT,
  proxima_manutencao_data DATE,
  proxima_manutencao_km INT,
  status public.status_manutencao NOT NULL DEFAULT 'agendada',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  tipo public.tipo_alerta NOT NULL,
  mensagem TEXT NOT NULL,
  data_vencimento DATE NOT NULL,
  status public.status_alerta NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2.1 COLUNAS NOVAS EM manutencoes (bases ja existentes)
-- Cole e execute este bloco se a tabela ja existia sem os campos novos
-- ============================================================
ALTER TABLE public.manutencoes
  ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT;

ALTER TABLE public.manutencoes
  ADD COLUMN IF NOT EXISTS proxima_manutencao_previsao TEXT;

ALTER TABLE public.manutencoes
  ADD COLUMN IF NOT EXISTS proxima_manutencao_data DATE;

ALTER TABLE public.manutencoes
  ADD COLUMN IF NOT EXISTS proxima_manutencao_km INT;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'manutencoes_metodo_pagamento_check'
  ) THEN
    ALTER TABLE public.manutencoes
      ADD CONSTRAINT manutencoes_metodo_pagamento_check
      CHECK (
        metodo_pagamento IS NULL
        OR metodo_pagamento IN ('cartao', 'pix', 'boleto', 'faturado', 'dinheiro', 'transferencia')
      );
  END IF;
END;
$constraint$;

-- ============================================================
-- 3. INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_veiculos_status ON public.veiculos(status);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON public.veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculo ON public.manutencoes(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_data ON public.manutencoes(data_hora);
CREATE INDEX IF NOT EXISTS idx_manutencoes_status ON public.manutencoes(status);
CREATE INDEX IF NOT EXISTS idx_alertas_veiculo ON public.alertas(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_alertas_status ON public.alertas(status);

-- ============================================================
-- 4. FUNCOES E TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  INSERT INTO public.usuarios (id, email, nome, perfil)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'perfil', 'motorista')::public.perfil_usuario
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    nome = EXCLUDED.nome,
    perfil = EXCLUDED.perfil;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.get_user_perfil()
RETURNS public.perfil_usuario
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT perfil FROM public.usuarios WHERE id = auth.uid();
$func$;

CREATE OR REPLACE FUNCTION public.atualizar_status_veiculo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.status = 'em_andamento'::public.status_manutencao THEN
    UPDATE public.veiculos SET status = 'em_manutencao'::public.status_veiculo WHERE id = NEW.veiculo_id;
  ELSIF NEW.status = 'concluida'::public.status_manutencao THEN
    UPDATE public.veiculos SET status = 'em_operacao'::public.status_veiculo WHERE id = NEW.veiculo_id;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_atualizar_status_veiculo ON public.manutencoes;
CREATE TRIGGER trg_atualizar_status_veiculo
  AFTER UPDATE OF status ON public.manutencoes
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_status_veiculo();

CREATE OR REPLACE FUNCTION public.gerar_alertas_manutencao()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  NULL;
END;
$func$;

-- ============================================================
-- 5. GRANTS (anon + authenticated)
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated;

-- ============================================================
-- 6. RLS — habilitar
-- ============================================================
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. REMOVER POLICIES ANTIGAS (evita conflito)
-- ============================================================
DO $drop$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('usuarios', 'veiculos', 'manutencoes', 'alertas')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END;
$drop$;

-- ============================================================
-- 8. POLICIES PERMISSIVAS (DEV/TCC — anon + authenticated)
-- ============================================================

-- USUARIOS
CREATE POLICY "anon_select_usuarios"
  ON public.usuarios FOR SELECT TO anon
  USING (true);

CREATE POLICY "authenticated_all_usuarios"
  ON public.usuarios FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- VEICULOS
CREATE POLICY "anon_select_veiculos"
  ON public.veiculos FOR SELECT TO anon
  USING (true);

CREATE POLICY "authenticated_all_veiculos"
  ON public.veiculos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- MANUTENCOES
CREATE POLICY "anon_select_manutencoes"
  ON public.manutencoes FOR SELECT TO anon
  USING (true);

CREATE POLICY "authenticated_all_manutencoes"
  ON public.manutencoes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ALERTAS
CREATE POLICY "anon_select_alertas"
  ON public.alertas FOR SELECT TO anon
  USING (true);

CREATE POLICY "authenticated_all_alertas"
  ON public.alertas FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ============================================================
-- 9. SINCRONIZAR PERFIS DE USUARIOS AUTH EXISTENTES
-- ============================================================
INSERT INTO public.usuarios (id, email, nome, perfil)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'perfil', 'motorista')::public.perfil_usuario
FROM auth.users AS u
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  nome = EXCLUDED.nome,
  perfil = EXCLUDED.perfil;

-- ============================================================
-- 10. VERIFICACAO FINAL
-- ============================================================
SELECT 'usuarios' AS tabela, COUNT(*) AS registros FROM public.usuarios
UNION ALL
SELECT 'veiculos', COUNT(*) FROM public.veiculos
UNION ALL
SELECT 'manutencoes', COUNT(*) FROM public.manutencoes
UNION ALL
SELECT 'alertas', COUNT(*) FROM public.alertas;

SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
