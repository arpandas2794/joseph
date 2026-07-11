import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  apiKeys: {
    gemini?: string;
    openai?: string;
    anthropic?: string;
  };
  setApiKey: (provider: 'gemini' | 'openai' | 'anthropic', key: string) => void;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  loadFromSupabase: (user: any) => void;
  syncToSupabase: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      apiKeys: {},
      setApiKey: (provider, key) => 
        set((state) => ({ apiKeys: { ...state.apiKeys, [provider]: key } })),
      isSettingsModalOpen: false,
      setIsSettingsModalOpen: (isOpen) => set({ isSettingsModalOpen: isOpen }),
      loadFromSupabase: (user) => {
        if (user?.user_metadata?.apiKeys) {
          set({ apiKeys: user.user_metadata.apiKeys });
        }
      },
      syncToSupabase: async () => {
        const { supabase } = await import('../lib/supabase');
        await supabase.auth.updateUser({
          data: { apiKeys: get().apiKeys }
        });
      }
    }),
    { 
      name: 'neuron-settings',
      partialize: (state) => ({ apiKeys: state.apiKeys }) // Only persist API keys
    }
  )
);
