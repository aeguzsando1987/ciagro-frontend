import { create } from 'zustand'

interface SelectedDc {
  id: string
  name: string
}

interface WorkspaceState {
  selectedDc: SelectedDc | null
  setSelectedDc: (dc: SelectedDc) => void
  clearSelectedDc: () => void
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  selectedDc: null,
  setSelectedDc: (dc) => set({ selectedDc: dc }),
  clearSelectedDc: () => set({ selectedDc: null }),
}))
