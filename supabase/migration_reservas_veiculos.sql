-- Reservas de veículos + campos ano_modelo / ano_carroceria
-- Execute no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  motorista_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  data_viagem TIMESTAMPTZ NOT NULL,
  destino TEXT NOT NULL,
  km_ida_volta INTEGER NOT NULL CHECK (km_ida_volta > 0),
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADO', 'REJEITADO')),
  observacao_gestor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservas_empresa ON public.reservas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_reservas_veiculo ON public.reservas(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_reservas_motorista ON public.reservas(motorista_id);
CREATE INDEX IF NOT EXISTS idx_reservas_status ON public.reservas(status);

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS ano_modelo INTEGER,
  ADD COLUMN IF NOT EXISTS ano_carroceria INTEGER;

UPDATE public.veiculos
SET ano_modelo = ano
WHERE ano_modelo IS NULL AND ano IS NOT NULL;

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservas_select_policy" ON public.reservas;
DROP POLICY IF EXISTS "reservas_insert_policy" ON public.reservas;
DROP POLICY IF EXISTS "reservas_update_policy" ON public.reservas;

CREATE POLICY "reservas_select_policy" ON public.reservas
FOR SELECT TO authenticated
USING (
  public.auth_user_perfil() = 'super_admin'
  OR empresa_id = public.auth_user_empresa_id()
);

CREATE POLICY "reservas_insert_policy" ON public.reservas
FOR INSERT TO authenticated
WITH CHECK (
  motorista_id = auth.uid()
  AND empresa_id = public.auth_user_empresa_id()
);

CREATE POLICY "reservas_update_policy" ON public.reservas
FOR UPDATE TO authenticated
USING (
  public.auth_user_perfil() IN ('super_admin', 'gestor', 'gerente')
  OR motorista_id = auth.uid()
)
WITH CHECK (
  public.auth_user_perfil() IN ('super_admin', 'gestor', 'gerente')
  OR motorista_id = auth.uid()
);
