-- ============================================================
-- FrotaMaq - Schema do Banco de Dados
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Tipos ENUM (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'perfil_usuario') THEN
    CREATE TYPE perfil_usuario AS ENUM ('gerente', 'mecanico', 'motorista');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_veiculo') THEN
    CREATE TYPE status_veiculo AS ENUM ('em_operacao', 'em_manutencao', 'fora_de_operacao');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_manutencao') THEN
    CREATE TYPE tipo_manutencao AS ENUM ('preventiva', 'corretiva', 'preditiva');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_manutencao') THEN
    CREATE TYPE status_manutencao AS ENUM ('agendada', 'em_andamento', 'concluida', 'cancelada');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_alerta') THEN
    CREATE TYPE tipo_alerta AS ENUM ('vencida', 'proxima');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_alerta') THEN
    CREATE TYPE status_alerta AS ENUM ('ativo', 'resolvido');
  END IF;
END;
$$;

-- ============================================================
-- TABELA: usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  perfil perfil_usuario NOT NULL DEFAULT 'motorista',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: veiculos
-- ============================================================
CREATE TABLE IF NOT EXISTS veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placa TEXT NOT NULL UNIQUE,
  modelo TEXT NOT NULL,
  marca TEXT NOT NULL,
  ano INT NOT NULL CHECK (ano >= 1900 AND ano <= 2100),
  km_atual INT NOT NULL DEFAULT 0 CHECK (km_atual >= 0),
  status status_veiculo NOT NULL DEFAULT 'em_operacao',
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: manutencoes
-- ============================================================
CREATE TABLE IF NOT EXISTS manutencoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  tipo tipo_manutencao NOT NULL,
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
  status status_manutencao NOT NULL DEFAULT 'agendada',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: alertas
-- ============================================================
CREATE TABLE IF NOT EXISTS alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  tipo tipo_alerta NOT NULL,
  mensagem TEXT NOT NULL,
  data_vencimento DATE NOT NULL,
  status status_alerta NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_veiculos_status ON veiculos(status);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculo ON manutencoes(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_data ON manutencoes(data_hora);
CREATE INDEX IF NOT EXISTS idx_manutencoes_status ON manutencoes(status);
CREATE INDEX IF NOT EXISTS idx_alertas_veiculo ON alertas(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_alertas_status ON alertas(status);

-- ============================================================
-- FUNCAO: Gerar alertas automaticos de manutencao
-- Manutencoes vencidas -> 'vencida' (vermelho)
-- Manutencoes a vencer em ate 30 dias -> 'proxima' (laranja)
-- ============================================================
CREATE OR REPLACE FUNCTION public.gerar_alertas_manutencao()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Resolve alertas de manutencoes concluidas ou canceladas
  UPDATE public.alertas
  SET status = 'resolvido'::status_alerta
  WHERE status = 'ativo'::status_alerta
    AND veiculo_id IN (
      SELECT veiculo_id
      FROM public.manutencoes
      WHERE status IN ('concluida'::status_manutencao, 'cancelada'::status_manutencao)
        AND data_hora >= (CURRENT_DATE - INTERVAL '1 day')
    );

  -- Insere alertas vencidos
  INSERT INTO public.alertas (veiculo_id, tipo, mensagem, data_vencimento, status)
  SELECT
    m.veiculo_id,
    'vencida'::tipo_alerta,
    'Manutencao vencida: ' || m.descricao,
    m.data_hora::DATE,
    'ativo'::status_alerta
  FROM public.manutencoes AS m
  WHERE m.status IN ('agendada'::status_manutencao, 'em_andamento'::status_manutencao)
    AND m.data_hora::DATE < CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1
      FROM public.alertas AS a
      WHERE a.veiculo_id = m.veiculo_id
        AND a.tipo = 'vencida'::tipo_alerta
        AND a.status = 'ativo'::status_alerta
        AND a.mensagem LIKE ('%' || m.descricao || '%')
    );

  -- Insere alertas proximos (ate 30 dias)
  INSERT INTO public.alertas (veiculo_id, tipo, mensagem, data_vencimento, status)
  SELECT
    m.veiculo_id,
    'proxima'::tipo_alerta,
    'Manutencao proxima: ' || m.descricao,
    m.data_hora::DATE,
    'ativo'::status_alerta
  FROM public.manutencoes AS m
  WHERE m.status IN ('agendada'::status_manutencao, 'em_andamento'::status_manutencao)
    AND m.data_hora::DATE BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')
    AND NOT EXISTS (
      SELECT 1
      FROM public.alertas AS a
      WHERE a.veiculo_id = m.veiculo_id
        AND a.tipo = 'proxima'::tipo_alerta
        AND a.status = 'ativo'::status_alerta
        AND a.mensagem LIKE ('%' || m.descricao || '%')
    );
END;
$func$;

-- ============================================================
-- FUNCAO + TRIGGER: Atualizar status do veiculo ao concluir manutencao
-- ============================================================
CREATE OR REPLACE FUNCTION public.atualizar_status_veiculo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.status = 'em_andamento'::status_manutencao THEN
    UPDATE public.veiculos
    SET status = 'em_manutencao'::status_veiculo
    WHERE id = NEW.veiculo_id;
  ELSIF NEW.status = 'concluida'::status_manutencao THEN
    UPDATE public.veiculos
    SET status = 'em_operacao'::status_veiculo
    WHERE id = NEW.veiculo_id;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_atualizar_status_veiculo ON public.manutencoes;

CREATE TRIGGER trg_atualizar_status_veiculo
  AFTER UPDATE OF status ON public.manutencoes
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_status_veiculo();

-- ============================================================
-- FUNCAO + TRIGGER: Criar perfil de usuario ao registrar
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
    COALESCE(NEW.raw_user_meta_data->>'perfil', 'motorista')::perfil_usuario
  );

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNCAO HELPER: obter perfil do usuario autenticado
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_perfil()
RETURNS perfil_usuario
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT perfil
  FROM public.usuarios
  WHERE id = auth.uid();
$func$;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - RBAC
-- ============================================================
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

-- ---- USUARIOS ----
DROP POLICY IF EXISTS "Usuarios podem ver seu proprio perfil" ON public.usuarios;
CREATE POLICY "Usuarios podem ver seu proprio perfil"
  ON public.usuarios
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Gerentes podem ver todos os usuarios" ON public.usuarios;
CREATE POLICY "Gerentes podem ver todos os usuarios"
  ON public.usuarios
  FOR SELECT
  USING (public.get_user_perfil() = 'gerente'::perfil_usuario);

-- ---- VEICULOS ----
DROP POLICY IF EXISTS "Todos autenticados podem ler veiculos" ON public.veiculos;
CREATE POLICY "Todos autenticados podem ler veiculos"
  ON public.veiculos
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Gerentes podem inserir veiculos" ON public.veiculos;
CREATE POLICY "Gerentes podem inserir veiculos"
  ON public.veiculos
  FOR INSERT
  WITH CHECK (public.get_user_perfil() = 'gerente'::perfil_usuario);

DROP POLICY IF EXISTS "Gerentes podem atualizar veiculos" ON public.veiculos;
CREATE POLICY "Gerentes podem atualizar veiculos"
  ON public.veiculos
  FOR UPDATE
  USING (public.get_user_perfil() = 'gerente'::perfil_usuario);

DROP POLICY IF EXISTS "Mecanicos podem atualizar km e status" ON public.veiculos;
CREATE POLICY "Mecanicos podem atualizar km e status"
  ON public.veiculos
  FOR UPDATE
  USING (public.get_user_perfil() = 'mecanico'::perfil_usuario);

DROP POLICY IF EXISTS "Gerentes podem excluir veiculos" ON public.veiculos;
CREATE POLICY "Gerentes podem excluir veiculos"
  ON public.veiculos
  FOR DELETE
  USING (public.get_user_perfil() = 'gerente'::perfil_usuario);

-- ---- MANUTENCOES ----
DROP POLICY IF EXISTS "Todos autenticados podem ler manutencoes" ON public.manutencoes;
CREATE POLICY "Todos autenticados podem ler manutencoes"
  ON public.manutencoes
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Gerentes e mecanicos podem inserir manutencoes" ON public.manutencoes;
CREATE POLICY "Gerentes e mecanicos podem inserir manutencoes"
  ON public.manutencoes
  FOR INSERT
  WITH CHECK (public.get_user_perfil() IN ('gerente'::perfil_usuario, 'mecanico'::perfil_usuario));

DROP POLICY IF EXISTS "Gerentes e mecanicos podem atualizar manutencoes" ON public.manutencoes;
CREATE POLICY "Gerentes e mecanicos podem atualizar manutencoes"
  ON public.manutencoes
  FOR UPDATE
  USING (public.get_user_perfil() IN ('gerente'::perfil_usuario, 'mecanico'::perfil_usuario));

DROP POLICY IF EXISTS "Gerentes podem excluir manutencoes" ON public.manutencoes;
CREATE POLICY "Gerentes podem excluir manutencoes"
  ON public.manutencoes
  FOR DELETE
  USING (public.get_user_perfil() = 'gerente'::perfil_usuario);

-- ---- ALERTAS ----
DROP POLICY IF EXISTS "Todos autenticados podem ler alertas" ON public.alertas;
CREATE POLICY "Todos autenticados podem ler alertas"
  ON public.alertas
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Gerentes podem gerenciar alertas" ON public.alertas;
CREATE POLICY "Gerentes podem gerenciar alertas"
  ON public.alertas
  FOR ALL
  USING (public.get_user_perfil() = 'gerente'::perfil_usuario);

DROP POLICY IF EXISTS "Mecanicos podem resolver alertas" ON public.alertas;
CREATE POLICY "Mecanicos podem resolver alertas"
  ON public.alertas
  FOR UPDATE
  USING (public.get_user_perfil() = 'mecanico'::perfil_usuario);

-- ============================================================
-- DADOS DE EXEMPLO (opcional - descomente para testar)
-- ============================================================
/*
INSERT INTO public.veiculos (placa, modelo, marca, ano, km_atual, status) VALUES
  ('ABC-1234', 'Gol', 'Volkswagen', 2022, 72540, 'em_operacao'),
  ('DEF-5678', 'Hilux', 'Toyota', 2021, 45000, 'em_operacao'),
  ('GHI-9012', 'Sprinter', 'Mercedes-Benz', 2020, 120000, 'em_manutencao'),
  ('JKL-3456', 'Civic', 'Honda', 2023, 15000, 'fora_de_operacao');

INSERT INTO public.manutencoes (veiculo_id, tipo, descricao, data_hora, local, responsavel, valor, status)
SELECT v.id, 'preventiva', 'Troca de oleo', NOW() + INTERVAL '3 days', 'Oficina Central', 'Joao Mecanico', 350.00, 'agendada'
FROM public.veiculos AS v
WHERE v.placa = 'ABC-1234';

INSERT INTO public.manutencoes (veiculo_id, tipo, descricao, data_hora, local, responsavel, valor, status)
SELECT v.id, 'corretiva', 'Troca de pastilhas de freio', NOW() - INTERVAL '30 days', 'Auto Center', 'Carlos Silva', 450.00, 'concluida'
FROM public.veiculos AS v
WHERE v.placa = 'ABC-1234';
*/
