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
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKeys: {},
      setApiKey: (provider, key) => 
        set((state) => ({ apiKeys: { ...state.apiKeys, [provider]: key } })),
      isSettingsModalOpen: false,
      setIsSettingsModalOpen: (isOpen) => set({ isSettingsModalOpen: isOpen }),
    }),
    { 
      name: 'neuron-settings',
      partialize: (state) => ({ apiKeys: state.apiKeys }) // Only persist API keys
    }
  )
);
