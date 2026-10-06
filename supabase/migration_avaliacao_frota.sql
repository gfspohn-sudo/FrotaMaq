-- =============================================================================
-- FrotaMaq — Avaliação: manutenções, viagens (km), status e RLS de custos
-- Execute no SQL Editor do Supabase APÓS o schema atual.
-- Idempotente (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- Sem transação única: ADD VALUE de enum não pode ser usado no mesmo COMMIT.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_reserva') THEN
    ALTER TYPE public.status_reserva ADD VALUE IF NOT EXISTS 'CONCLUIDA';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 1. VEÍCULOS — intervalos padrão + status canônicos
-- ---------------------------------------------------------------------------
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS intervalo_manutencao_km INTEGER NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS intervalo_manutencao_dias INTEGER NOT NULL DEFAULT 180;

UPDATE public.veiculos
SET status = CASE
  WHEN UPPER(TRIM(REPLACE(status, ' ', '_'))) IN ('ATIVO', 'EM_OPERACAO', 'DISPONIVEL', 'OPERACAO') THEN 'DISPONIVEL'
  WHEN UPPER(TRIM(REPLACE(status, ' ', '_'))) IN ('EM_VIAGEM') THEN 'EM_VIAGEM'
  WHEN UPPER(TRIM(REPLACE(status, ' ', '_'))) IN ('EM_MANUTENCAO', 'MANUTENCAO') THEN 'EM_MANUTENCAO'
  WHEN UPPER(TRIM(REPLACE(status, ' ', '_'))) IN ('INATIVO', 'FORA_DE_OPERACAO', 'PARADO') THEN 'PARADO'
  ELSE status
END
WHERE status IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. MANUTENÇÕES — histórico, custos discriminados e próxima OS
-- ---------------------------------------------------------------------------
ALTER TABLE public.manutencoes
  ADD COLUMN IF NOT EXISTS km_atual_veiculo INTEGER,
  ADD COLUMN IF NOT EXISTS pecas_trocadas JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS valor_mao_de_obra NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_pecas NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS proxima_manutencao_km INTEGER,
  ADD COLUMN IF NOT EXISTS data_proxima_manutencao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS local_manutencao TEXT,
  ADD COLUMN IF NOT EXISTS responsavel TEXT,
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDENTE';

UPDATE public.manutencoes
SET valor_pecas = COALESCE(valor_pecas, 0),
    valor_mao_de_obra = CASE
      WHEN COALESCE(valor_mao_de_obra, 0) = 0 AND COALESCE(valor_pecas, 0) = 0
        THEN COALESCE(valor_total, 0)
      ELSE COALESCE(valor_mao_de_obra, 0)
    END
WHERE TRUE;

-- ---------------------------------------------------------------------------
-- 3. RESERVAS / VIAGENS — km inicial/final e status CONCLUIDA
-- ---------------------------------------------------------------------------
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS km_inicial INTEGER,
  ADD COLUMN IF NOT EXISTS km_final INTEGER,
  ADD COLUMN IF NOT EXISTS km_percorrido INTEGER,
  ADD COLUMN IF NOT EXISTS data_fim TIMESTAMPTZ;

DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservas' AND column_name = 'status'
      AND udt_name = 'text'
  ) THEN
    FOR r IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'reservas' AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%status%'
    LOOP
      EXECUTE format('ALTER TABLE public.reservas DROP CONSTRAINT %I', r.conname);
    END LOOP;

    ALTER TABLE public.reservas
      ADD CONSTRAINT reservas_status_check
      CHECK (status IN ('PENDENTE', 'APROVADO', 'REJEITADO', 'CONCLUIDA'));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 4. TRIGGER — próxima manutenção automática no INSERT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_proxima_manutencao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_km INTEGER;
  v_intervalo_km INTEGER;
  v_intervalo_dias INTEGER;
BEGIN
  SELECT COALESCE(quilometragem_atual, 0),
         COALESCE(intervalo_manutencao_km, 10000),
         COALESCE(intervalo_manutencao_dias, 180)
    INTO v_km, v_intervalo_km, v_intervalo_dias
  FROM public.veiculos
  WHERE id = NEW.veiculo_id;

  IF NEW.km_atual_veiculo IS NULL THEN
    NEW.km_atual_veiculo := v_km;
  END IF;

  IF NEW.proxima_manutencao_km IS NULL THEN
    NEW.proxima_manutencao_km := COALESCE(NEW.km_atual_veiculo, v_km) + v_intervalo_km;
  END IF;

  IF NEW.data_proxima_manutencao IS NULL THEN
    NEW.data_proxima_manutencao := COALESCE(NEW.data_manutencao, NOW())
      + make_interval(days => v_intervalo_dias);
  END IF;

  IF COALESCE(NEW.valor_total, 0) = 0 THEN
    NEW.valor_total := COALESCE(NEW.valor_mao_de_obra, 0) + COALESCE(NEW.valor_pecas, 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calcular_proxima_manutencao ON public.manutencoes;
CREATE TRIGGER trg_calcular_proxima_manutencao
  BEFORE INSERT ON public.manutencoes
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_proxima_manutencao();

-- ---------------------------------------------------------------------------
-- 5. TRIGGER — finalizar viagem atualiza KM e status do veículo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalizar_viagem_atualizar_veiculo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.km_final IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.km_final IS NULL OR NEW.km_final IS DISTINCT FROM OLD.km_final)
  THEN
    IF NEW.km_inicial IS NULL THEN
      SELECT COALESCE(quilometragem_atual, 0) INTO NEW.km_inicial
      FROM public.veiculos WHERE id = NEW.veiculo_id;
    END IF;

    IF NEW.km_final < NEW.km_inicial THEN
      RAISE EXCEPTION 'km_final (%) não pode ser menor que km_inicial (%)', NEW.km_final, NEW.km_inicial;
    END IF;

    NEW.km_percorrido := NEW.km_final - NEW.km_inicial;
    NEW.data_fim := COALESCE(NEW.data_fim, NOW());
    NEW.status := 'CONCLUIDA';

    UPDATE public.veiculos
    SET quilometragem_atual = NEW.km_final,
        status = 'DISPONIVEL'
    WHERE id = NEW.veiculo_id
      AND empresa_id = NEW.empresa_id;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'veiculos' AND column_name = 'km_atual'
    ) THEN
      UPDATE public.veiculos SET km_atual = NEW.km_final WHERE id = NEW.veiculo_id;
    END IF;
  END IF;

  IF NEW.status::text = 'APROVADO'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    IF NEW.km_inicial IS NULL THEN
      SELECT COALESCE(quilometragem_atual, 0) INTO NEW.km_inicial
      FROM public.veiculos WHERE id = NEW.veiculo_id;
    END IF;

    UPDATE public.veiculos
    SET status = 'EM_VIAGEM'
    WHERE id = NEW.veiculo_id
      AND empresa_id = NEW.empresa_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finalizar_viagem ON public.reservas;
CREATE TRIGGER trg_finalizar_viagem
  BEFORE INSERT OR UPDATE ON public.reservas
  FOR EACH ROW
  EXECUTE FUNCTION public.finalizar_viagem_atualizar_veiculo();

-- ---------------------------------------------------------------------------
-- 6. RLS — relatórios gerenciais / custos: Gestor e Super Admin
--    Motorista não lê a tabela de manutenções (valores e peças).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'auth_user_perfil') THEN
    DROP POLICY IF EXISTS "manutencoes_select_policy" ON public.manutencoes;
    DROP POLICY IF EXISTS "manutencoes_select" ON public.manutencoes;

    CREATE POLICY "manutencoes_select_policy" ON public.manutencoes
    FOR SELECT TO authenticated
    USING (
      public.auth_user_perfil() = 'super_admin'
      OR (
        empresa_id = public.auth_user_empresa_id()
        AND public.auth_user_perfil() IN ('gestor', 'gerente', 'mecanico')
      )
    );
  END IF;
END $$;
