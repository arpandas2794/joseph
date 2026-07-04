import { supabase } from './supabase';
import type { Workspace } from '../types/database';

export const workspaceApi = {
  async getWorkspaces(): Promise<Workspace[]> {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createWorkspace(name: string): Promise<Workspace> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('workspaces')
      .insert([
        {
          name,
          user_id: userData.user.id,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateWorkspaceName(id: string, name: string): Promise<void> {
    const { error } = await supabase.from('workspaces').update({ name }).eq('id', id);
    if (error) throw error;
  },

  async deleteWorkspace(id: string): Promise<void> {
    const { error } = await supabase.from('workspaces').delete().eq('id', id);
    if (error) throw error;
  },

  async getWorkspaceData(workspaceId: string) {
    const [cardsResult, edgesResult] = await Promise.all([
      supabase.from('cards').select('*').eq('workspace_id', workspaceId),
      supabase.from('connections').select('*').eq('workspace_id', workspaceId),
    ]);

    if (cardsResult.error) throw cardsResult.error;
    if (edgesResult.error) throw edgesResult.error;

    return { cards: cardsResult.data || [], edges: edgesResult.data || [] };
  },

  async upsertCard(workspaceId: string, node: any) {
    const payload = {
      id: node.id,
      workspace_id: workspaceId,
      type: node.type,
      x: node.position?.x || 0,
      y: node.position?.y || 0,
      width: node.measured?.width || node.width || node.style?.width || 256,
      height: node.measured?.height || node.height || node.style?.height || 256,
      data: { ...(node.data || {}), parentId: node.parentId },
    };

    const { error } = await supabase.from('cards').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  },

  async updateCardData(workspaceId: string, id: string, data: any) {
    const { error } = await supabase.from('cards').update({ data }).eq('id', id).eq('workspace_id', workspaceId);
    if (error) throw error;
  },

  async deleteCard(cardId: string) {
    const { error } = await supabase.from('cards').delete().eq('id', cardId);
    if (error) throw error;
  },

  async createEdge(workspaceId: string, edge: { id: string, source_id: string, target_id: string, source_type: string }) {
    const { error } = await supabase.from('connections').insert({
      id: edge.id,
      workspace_id: workspaceId,
      source_id: edge.source_id,
      target_chat_id: edge.target_id,
      source_type: edge.source_type
    });
    if (error) throw error;
  },

  async deleteEdge(edgeId: string) {
    const { error } = await supabase.from('connections').delete().eq('id', edgeId);
    if (error) throw error;
  },

  async extractLink(url: string) {
    const response = await fetch('http://localhost:3001/api/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to extract link');
    }
    return response.json();
  },

  async uploadVoiceToStorage(file: Blob, fileName: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('voice-notes')
      .upload(`public/${fileName}`, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('voice-notes')
      .getPublicUrl(data.path);

    return publicUrl;
  },

  async transcribeVoice(audioBlob: Blob): Promise<{ transcript: string }> {
    const formData = new FormData();
    // Use .webm extension to match most browser's MediaRecorder output
    formData.append('audio', audioBlob, 'recording.webm');

    const response = await fetch('http://localhost:3001/api/transcribe-voice', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to transcribe voice');
    }

    return response.json();
  }
};
