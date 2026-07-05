-- Run this in your Supabase SQL Editor

-- 1. Add active branch tracking to conversations
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS active_branch_id uuid;

-- 2. Create Branches table
CREATE TABLE IF NOT EXISTS ai_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE CASCADE,
  parent_branch_id uuid REFERENCES ai_branches(id) ON DELETE CASCADE,
  parent_message_id uuid, -- Reference added later to avoid circular issues
  name text,
  created_at timestamptz DEFAULT now()
);

-- 3. Update Messages table to support trees
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES ai_branches(id) ON DELETE CASCADE;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS parent_message_id uuid REFERENCES ai_messages(id) ON DELETE SET NULL;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 4. Add foreign key back to branches for parent_message_id
ALTER TABLE ai_branches ADD CONSTRAINT fk_parent_message
  FOREIGN KEY (parent_message_id) REFERENCES ai_messages(id) ON DELETE CASCADE;
