-- Grant permissions to the authenticated role for all our tables
GRANT ALL ON TABLE workspaces TO authenticated;
GRANT ALL ON TABLE cards TO authenticated;
GRANT ALL ON TABLE groups TO authenticated;
GRANT ALL ON TABLE card_group_memberships TO authenticated;
GRANT ALL ON TABLE connections TO authenticated;
GRANT ALL ON TABLE ai_conversations TO authenticated;
GRANT ALL ON TABLE ai_messages TO authenticated;

-- Grant permissions to the service_role (backend API)
GRANT ALL ON TABLE workspaces TO service_role;
GRANT ALL ON TABLE cards TO service_role;
GRANT ALL ON TABLE groups TO service_role;
GRANT ALL ON TABLE card_group_memberships TO service_role;
GRANT ALL ON TABLE connections TO service_role;
GRANT ALL ON TABLE ai_conversations TO service_role;
GRANT ALL ON TABLE ai_messages TO service_role;
