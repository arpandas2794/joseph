import React from 'react';
import { X, Key, Settings, Sparkles, BrainCircuit } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';

export default function SettingsModal() {
  const { isSettingsModalOpen, setIsSettingsModalOpen, apiKeys, setApiKey } = useSettingsStore();

  if (!isSettingsModalOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) setIsSettingsModalOpen(false); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#111113] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

        <div className="p-6 pb-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/15 rounded-xl flex items-center justify-center border border-indigo-500/20">
              <Settings className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white leading-tight">Settings</h2>
              <p className="text-[11px] text-gray-400">Bring your own keys</p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsModalOpen(false)}
            className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
              <Key className="w-4 h-4 text-gray-400" />
              API Keys (Local)
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Your API keys are stored securely in your browser's local storage and are never saved to our database. They are only used when you generate responses in the AI Chat.
            </p>

            <div className="space-y-4">
              {/* Gemini Key */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Google Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKeys.gemini || ''}
                  onChange={(e) => setApiKey('gemini', e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all text-sm font-mono"
                />
              </div>

              {/* OpenAI Key */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                  <BrainCircuit className="w-3.5 h-3.5 text-emerald-400" />
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  value={apiKeys.openai || ''}
                  onChange={(e) => setApiKey('openai', e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all text-sm font-mono"
                />
              </div>

              {/* Anthropic Key */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                  <BrainCircuit className="w-3.5 h-3.5 text-amber-500" />
                  Anthropic API Key
                </label>
                <input
                  type="password"
                  value={apiKeys.anthropic || ''}
                  onChange={(e) => setApiKey('anthropic', e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all text-sm font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/5 flex-shrink-0 bg-black/20">
          <button
            onClick={async () => {
              setIsSettingsModalOpen(false);
              await useSettingsStore.getState().syncToSupabase();
            }}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors shadow-[0_0_20px_rgba(99,102,241,0.2)]"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}
