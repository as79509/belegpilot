-- Migration: Add onboarding_drafts table
-- This table stores wizard state before a company is created

CREATE TABLE IF NOT EXISTS onboarding_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  current_step INT DEFAULT 0,
  data JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'in_progress',
  completed_at TIMESTAMP,
  company_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for finding user's drafts
CREATE INDEX IF NOT EXISTS idx_onboarding_drafts_user_status 
  ON onboarding_drafts(user_id, status);

-- Comment for documentation
COMMENT ON TABLE onboarding_drafts IS 'Stores wizard state for Airbnb-style client onboarding before company creation';
