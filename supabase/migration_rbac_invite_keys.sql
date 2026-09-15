-- RBAC: Chaves de convite + Solicitações de acesso a relatório
-- Execute no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.chaves_convite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  perfil TEXT NOT NULL CHECK (perfil IN ('motorista', 'mecanico')),
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chaves_convite_token ON public.chaves_convite(token);
CREATE INDEX IF NOT EXISTS idx_chaves_convite_empresa ON public.chaves_convite(empresa_id);

CREATE TABLE IF NOT EXISTS public.solicitacoes_relatorio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  solicitante_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADO', 'REJEITADO')),
  observacao_gestor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (veiculo_id, solicitante_id, status)
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_relatorio_empresa ON public.solicitacoes_relatorio(empresa_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_relatorio_status ON public.solicitacoes_relatorio(status);

ALTER TABLE public.chaves_convite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_relatorio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chaves_convite_select" ON public.chaves_convite;
DROP POLICY IF EXISTS "chaves_convite_insert" ON public.chaves_convite;
DROP POLICY IF EXISTS "chaves_convite_public_validate" ON public.chaves_convite;

CREATE POLICY "chaves_convite_select" ON public.chaves_convite
FOR SELECT TO authenticated
USING (
  public.auth_user_perfil() = 'super_admin'
  OR empresa_id = public.auth_user_empresa_id()
);

CREATE POLICY "chaves_convite_insert" ON public.chaves_convite
FOR INSERT TO authenticated
WITH CHECK (public.auth_user_perfil() = 'super_admin');

CREATE POLICY "chaves_convite_public_validate" ON public.chaves_convite
FOR SELECT TO anon, authenticated
USING (ativa = TRUE);

DROP POLICY IF EXISTS "solicitacoes_relatorio_select" ON public.solicitacoes_relatorio;
DROP POLICY IF EXISTS "solicitacoes_relatorio_insert" ON public.solicitacoes_relatorio;
DROP POLICY IF EXISTS "solicitacoes_relatorio_update" ON public.solicitacoes_relatorio;

CREATE POLICY "solicitacoes_relatorio_select" ON public.solicitacoes_relatorio
FOR SELECT TO authenticated
USING (
  public.auth_user_perfil() = 'super_admin'
  OR empresa_id = public.auth_user_empresa_id()
);

CREATE POLICY "solicitacoes_relatorio_insert" ON public.solicitacoes_relatorio
FOR INSERT TO authenticated
WITH CHECK (
  solicitante_id = auth.uid()
  AND empresa_id = public.auth_user_empresa_id()
);

CREATE POLICY "solicitacoes_relatorio_update" ON public.solicitacoes_relatorio
FOR UPDATE TO authenticated
USING (
  public.auth_user_perfil() IN ('super_admin', 'gestor', 'gerente')
  AND empresa_id = public.auth_user_empresa_id()
);
