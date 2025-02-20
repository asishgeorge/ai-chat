import { create } from 'zustand'

interface LLMStore {
    selectedModel: string
    setSelectedModel: (model: string) => void
}

export const useLLMStore = create<LLMStore>((set) => ({
    selectedModel: '',
    setSelectedModel: (model) => set({ selectedModel: model }),
}))