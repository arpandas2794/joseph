import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Check, Smartphone, Monitor, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { workspaceApi } from '../lib/api';
import type { Workspace } from '../types/database';
import Canvas from '../components/canvas/Canvas';
import { ReactFlowProvider } from '@xyflow/react';
import MobileWorkspace from '../components/mobile/MobileWorkspace';
import { useCanvasStore } from '../store/canvasStore';
import SettingsModal from '../components/shared/SettingsModal';
import { useSettingsStore } from '../store/settingsStore';

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  
  // Mobile View Toggle
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 768);

  // Listen for window resize to auto-switch if needed (optional, but good UX)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsMobileView(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const lastSaved = useCanvasStore((state) => state.lastSaved);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { setIsSettingsModalOpen } = useSettingsStore();

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
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <h2 className="text-xl mb-4">Workspace not found</h2>
        <button 
          onClick={() => navigate('/')}
          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#121214] text-white flex flex-col overflow-hidden">
      {/* Top Navbar */}
      <header className="h-14 border-b border-white/10 bg-black/50 backdrop-blur-xl flex items-center justify-between px-4 z-50 flex-shrink-0">
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
              className="bg-white/10 text-sm font-medium px-2 py-1 rounded outline-none border border-white/20 focus:border-indigo-500 w-48"
            />
          ) : (
            <h1 
              className="font-medium text-sm cursor-pointer hover:bg-white/5 px-2 py-1 rounded transition-colors truncate max-w-[200px]"
              onClick={() => setEditingName(true)}
              title="Click to edit"
            >
              {workspace.name}
            </h1>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="hidden sm:flex p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setIsMobileView(!isMobileView)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-colors"
          >
            {isMobileView ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                <span>Switch to Desktop</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                <span>Switch to Mobile</span>
              </>
            )}
          </button>

          <div className="hidden sm:flex text-xs text-gray-500 items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            {lastSaved ? `Saved at ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'All changes saved'}
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 relative flex flex-col min-h-0">
        {isMobileView ? (
          <div className="w-full h-full max-w-[480px] mx-auto border-x border-white/5 shadow-2xl relative bg-[#0a0a0c] flex flex-col min-h-0">
            <MobileWorkspace workspaceId={workspace.id} />
          </div>
        ) : (
          <ReactFlowProvider>
            <Canvas workspaceId={workspace.id} />
          </ReactFlowProvider>
        )}
      </main>
      
      {/* Settings Modal */}
      <SettingsModal />
    </div>
  );
}
