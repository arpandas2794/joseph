-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workspaces
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cards (Polymorphic content units & AI Chats)
CREATE TABLE cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'sticky', 'pdf', 'youtube', 'ai_chat', etc.
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    width FLOAT,
    height FLOAT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Content, metadata, etc.
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', data->>'content')) STORED, -- Full-text search
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    width FLOAT NOT NULL,
    height FLOAT NOT NULL,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Card Group Memberships (Many-to-Many)
CREATE TABLE card_group_memberships (
    card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (card_id, group_id)
);

-- Connections (Wires connecting cards/groups to AI Chats)
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    source_id UUID NOT NULL, -- Polymorphic (Card ID or Group ID)
    source_type TEXT NOT NULL, -- 'card' or 'group'
    target_chat_id UUID REFERENCES cards(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Conversations (History for AI Chat cards)
CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) Policies

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own workspaces" 
ON workspaces FOR ALL USING (auth.uid() = user_id);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage cards in their workspaces" 
ON cards FOR ALL USING (
    EXISTS (SELECT 1 FROM workspaces WHERE workspaces.id = cards.workspace_id AND workspaces.user_id = auth.uid())
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage groups in their workspaces" 
ON groups FOR ALL USING (
    EXISTS (SELECT 1 FROM workspaces WHERE workspaces.id = groups.workspace_id AND workspaces.user_id = auth.uid())
);

ALTER TABLE card_group_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage card group memberships in their workspaces" 
ON card_group_memberships FOR ALL USING (
    EXISTS (SELECT 1 FROM cards JOIN workspaces ON cards.workspace_id = workspaces.id WHERE cards.id = card_group_memberships.card_id AND workspaces.user_id = auth.uid())
);

ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage connections in their workspaces" 
ON connections FOR ALL USING (
    EXISTS (SELECT 1 FROM workspaces WHERE workspaces.id = connections.workspace_id AND workspaces.user_id = auth.uid())
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage ai_conversations in their workspaces" 
ON ai_conversations FOR ALL USING (
    EXISTS (SELECT 1 FROM cards JOIN workspaces ON cards.workspace_id = workspaces.id WHERE cards.id = ai_conversations.chat_card_id AND workspaces.user_id = auth.uid())
);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage ai_messages in their workspaces" 
ON ai_messages FOR ALL USING (
    EXISTS (
        SELECT 1 FROM ai_conversations 
        JOIN cards ON ai_conversations.chat_card_id = cards.id 
        JOIN workspaces ON cards.workspace_id = workspaces.id 
        WHERE ai_conversations.id = ai_messages.conversation_id AND workspaces.user_id = auth.uid()
    )
);
