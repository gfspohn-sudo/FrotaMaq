-- Histórico de auditoria operacional (viagem, manutenção, liberação).
-- Execute no SQL Editor do Supabase. Idempotente.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id UUID,
  usuario_nome TEXT,
  veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL,
  reserva_id UUID,
  acao TEXT NOT NULL,
  descricao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_veiculo ON public.audit_logs (veiculo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_reserva ON public.audit_logs (reserva_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_empresa ON public.audit_logs (empresa_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;

CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  public.auth_user_perfil() = 'super_admin'
  OR empresa_id = public.auth_user_empresa_id()
);

CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  public.auth_user_perfil() = 'super_admin'
  OR empresa_id = public.auth_user_empresa_id()
  OR empresa_id IS NULL
);
