import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { workspaceApi } from '../lib/api';
import type { Workspace } from '../types/database';
import Canvas from '../components/canvas/Canvas';
import { useCanvasStore } from '../store/canvasStore';

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  
  const lastSaved = useCanvasStore((state) => state.lastSaved);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchWorkspace() {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) throw error;
        setWorkspace(data);
        setNameInput(data.name);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchWorkspace();
  }, [id]);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [editingName]);

  const handleSaveName = async () => {
    setEditingName(false);
    if (!id || !workspace || nameInput.trim() === '' || nameInput === workspace.name) {
      setNameInput(workspace?.name || '');
      return;
    }
    
    try {
      await workspaceApi.updateWorkspaceName(id, nameInput);
      setWorkspace({ ...workspace, name: nameInput });
    } catch (err) {
      console.error("Failed to update workspace name:", err);
      setNameInput(workspace.name);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <h2 className="text-xl mb-4">Workspace not found</h2>
        <button 
          onClick={() => navigate('/')}
          className="text-purple-400 hover:text-purple-300 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#121214] text-white flex flex-col overflow-hidden">
      {/* Top Navbar */}
      <header className="h-14 border-b border-white/10 bg-black/50 backdrop-blur-xl flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          {editingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') {
                  setNameInput(workspace.name);
                  setEditingName(false);
                }
              }}
              className="bg-white/10 text-sm font-medium px-2 py-1 rounded outline-none border border-white/20 focus:border-purple-500 w-48"
            />
          ) : (
            <h1 
              className="font-medium text-sm cursor-pointer hover:bg-white/5 px-2 py-1 rounded transition-colors"
              onClick={() => setEditingName(true)}
              title="Click to edit"
            >
              {workspace.name}
            </h1>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500 flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
            {lastSaved ? `Saved at ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'All changes saved'}
          </div>
        </div>
      </header>

      {/* The Infinite Canvas */}
      <main className="flex-1 relative">
        <Canvas workspaceId={workspace.id} />
      </main>
    </div>
  );
}
