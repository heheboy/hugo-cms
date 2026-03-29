import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HugoProject, ContentFile, FileNode } from '@/types';

interface ProjectState {
  projects: HugoProject[];
  currentProject: HugoProject | null;
  fileTree: FileNode[];
  selectedFile: ContentFile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setProjects: (projects: HugoProject[]) => void;
  addProject: (project: HugoProject) => void;
  removeProject: (id: string) => void;
  setCurrentProject: (project: HugoProject | null) => void;
  setFileTree: (tree: FileNode[]) => void;
  setSelectedFile: (file: ContentFile | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      currentProject: null,
      fileTree: [],
      selectedFile: null,
      isLoading: false,
      error: null,

      setProjects: (projects) => set({ projects }),
      addProject: (project) =>
        set((state) => ({
          projects: [...state.projects.filter(p => p.path !== project.path), project],
        })),
      removeProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        })),
      setCurrentProject: (project) => set({ currentProject: project }),
      setFileTree: (tree) => set({ fileTree: tree }),
      setSelectedFile: (file) => set({ selectedFile: file }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'hugo-cms-projects',
      partialize: (state) => ({ projects: state.projects }),
    }
  )
);
