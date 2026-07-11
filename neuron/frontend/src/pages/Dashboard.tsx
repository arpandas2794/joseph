import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { LogOut, BrainCircuit, LayoutGrid, Plus, MoreVertical, Trash2, Loader2, FolderOpen, X, Sparkles, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { workspaceApi } from '../lib/api';
import type { Workspace } from '../types/database';
import SettingsModal from '../components/shared/SettingsModal';
import { useSettingsStore } from '../store/settingsStore';

export default function Dashboard() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const { setIsSettingsModalOpen } = useSettingsStore();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const data = await workspaceApi.getWorkspaces();
      setWorkspaces(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (showModal) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showModal]);

  const openModal = () => {
    setWorkspaceName('');
    setShowModal(true);
  };

  const closeModal = () => {
    if (creating) return;
    setShowModal(false);
    setWorkspaceName('');
  };

  const handleCreateWorkspace = async () => {
    const name = workspaceName.trim() || 'Untitled Workspace';
    try {
      setCreating(true);
      const newWorkspace = await workspaceApi.createWorkspace(name);
      setShowModal(false);
      navigate(`/workspace/${newWorkspace.id}`);
    } catch (err: any) {
      setError(err.message);
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreateWorkspace();
    if (e.key === 'Escape') closeModal();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await workspaceApi.deleteWorkspace(id);
      setWorkspaces(workspaces.filter(w => w.id !== id));
      setActiveMenu(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-black/50 p-4 flex flex-col h-screen sticky top-0 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center border border-purple-500/30">
            <BrainCircuit className="w-5 h-5 text-purple-400" />
          </div>
          <span className="font-semibold text-lg tracking-wide">Neuron</span>
        </div>

        <nav className="space-y-1 flex-1">
          <button className="w-full flex items-center gap-3 px-3 py-2 bg-white/5 rounded-lg text-white font-medium border border-white/5 shadow-sm">
            <LayoutGrid className="w-4 h-4" />
            Workspaces
          </button>
        </nav>

        <div className="mt-auto border-t border-white/10 pt-4 px-2 flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex-shrink-0" />
            <span className="text-sm truncate text-gray-300">{user?.email}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={signOut}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto relative">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto">
          <header className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Your Workspaces</h1>
              <p className="text-gray-400 mt-1">Manage your infinite canvases and context graphs.</p>
            </div>
            <button
              onClick={openModal}
              className="px-4 py-2.5 bg-white text-black font-medium rounded-xl hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
            >
              <Plus className="w-4 h-4" />
              New Workspace
            </button>
          </header>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="py-32 text-center border-2 border-dashed border-white/10 rounded-3xl bg-white/[0.02] backdrop-blur-sm">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10">
                <FolderOpen className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-medium mb-2">No workspaces yet</h3>
              <p className="text-gray-400 mb-8 max-w-sm mx-auto">Create your first infinite canvas to start mapping out your ideas, connecting AI, and organizing knowledge.</p>
              <button
                onClick={openModal}
                className="px-5 py-2.5 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-all border border-white/10 shadow-sm"
              >
                Create Workspace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className="group relative h-48 bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.08] hover:border-purple-500/30 transition-all cursor-pointer flex flex-col shadow-lg backdrop-blur-sm"
                  onClick={() => navigate(`/workspace/${workspace.id}`)}
                >
                  <div className="flex items-start justify-between mb-auto">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center border border-purple-500/20 text-purple-400">
                      <LayoutGrid className="w-5 h-5" />
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === workspace.id ? null : workspace.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenu === workspace.id && (
                      <div className="absolute top-12 right-4 w-32 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl overflow-hidden z-20">
                        <button
                          onClick={(e) => handleDelete(e, workspace.id)}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-medium text-lg truncate group-hover:text-purple-300 transition-colors">{workspace.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Updated {new Date(workspace.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Workspace Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

          {/* Modal */}
          <div className="relative w-full max-w-md bg-[#111113] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
            {/* Top glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-purple-500/60 to-transparent" />

            <div className="p-8">
              {/* Icon */}
              <div className="w-12 h-12 bg-purple-500/15 rounded-2xl flex items-center justify-center border border-purple-500/20 mb-5">
                <Sparkles className="w-6 h-6 text-purple-400" />
              </div>

              <h2 className="text-xl font-semibold text-white mb-1">Name your workspace</h2>
              <p className="text-sm text-gray-400 mb-6">Give it a name that reflects what you'll be building.</p>

              <input
                ref={inputRef}
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Content Strategy Q3"
                maxLength={60}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/8 transition-all text-sm"
              />

              <div className="flex gap-3 mt-5">
                <button
                  onClick={closeModal}
                  disabled={creating}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-medium text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWorkspace}
                  disabled={creating}
                  className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70 shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={closeModal}
              disabled={creating}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal />
    </div>
  );
}
