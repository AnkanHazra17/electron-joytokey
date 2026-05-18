import { create } from 'zustand'

interface UiStore {
  selectedDevicePath: string | null
  activeTab: string
  setSelectedDevice: (path: string | null) => void
  setActiveTab: (tab: string) => void
}

export const useUiStore = create<UiStore>((set) => ({
  selectedDevicePath: null,
  activeTab: 'devices',
  setSelectedDevice: (path) => set({ selectedDevicePath: path }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
