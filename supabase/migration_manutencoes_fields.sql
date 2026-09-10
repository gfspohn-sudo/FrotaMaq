-- Novos campos para manutencoes
-- Execute INTEIRO no SQL Editor do Supabase (copie tudo, sem "...")

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
