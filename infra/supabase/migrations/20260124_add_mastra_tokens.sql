-- ============================================================
-- Migration: Add Mastra Access Tokens for Agent Authentication
-- File: infra/supabase/migrations/20260124_add_mastra_tokens.sql
-- ============================================================

-- Mastra tokens table (stores external Mastra Cloud access tokens)
CREATE TABLE IF NOT EXISTS public.mastra_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name text NOT NULL,                    -- User-defined name (e.g., "Production", "Development")
  token text NOT NULL,                   -- Mastra Cloud Access Token (plain text for forwarding)

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mastra_tokens IS
'Mastra Cloud Access Tokens: User-managed tokens from Mastra Cloud for agent authentication.';

COMMENT ON COLUMN public.mastra_tokens.owner_id IS 'B user who owns this token';
COMMENT ON COLUMN public.mastra_tokens.name IS 'User-defined name for identification';
COMMENT ON COLUMN public.mastra_tokens.token IS 'Mastra Cloud access token (plain text)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mastra_tokens_owner ON public.mastra_tokens(owner_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_mastra_tokens_updated_at ON public.mastra_tokens;
CREATE TRIGGER trg_mastra_tokens_updated_at
BEFORE UPDATE ON public.mastra_tokens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add mastra_token_id to agents table
ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS mastra_token_id uuid REFERENCES public.mastra_tokens(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.agents.mastra_token_id IS 'Associated Mastra Cloud token for API authentication';

-- Index for agent → token lookup
CREATE INDEX IF NOT EXISTS idx_agents_mastra_token ON public.agents(mastra_token_id);
