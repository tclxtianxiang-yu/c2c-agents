-- Add mastra_agent_id column to agents table
-- This stores the agent identifier within the Mastra Cloud project

ALTER TABLE agents ADD COLUMN IF NOT EXISTS mastra_agent_id TEXT;

COMMENT ON COLUMN agents.mastra_agent_id IS 'The agent identifier within the Mastra Cloud project (e.g., twitter-writer)';
