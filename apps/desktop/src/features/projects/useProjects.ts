import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Project {
  id: string;
  name: string;
  instructions: string;
  documentIds: string[];
  createdAt: number;
}
interface ProjectsState {
  projects: Project[];
  selectedProjectId?: string;
  selectProject: (id?: string) => void;
  createProject: (name: string) => string;
  updateProject: (id: string, patch: Partial<Pick<Project, 'name' | 'instructions' | 'documentIds'>>) => void;
  deleteProject: (id: string) => void;
}
/** Device-local metadata. Files reference the real document knowledge library. */
export const useProjects = create<ProjectsState>()(persist((set) => ({
  projects: [],
  selectProject: (selectedProjectId) => set({ selectedProjectId }),
  createProject: (name) => {
    if (!name.trim()) throw new Error('Enter a project name.');
    const id = `project_${crypto.randomUUID()}`;
    set(state => ({ projects: [...state.projects, { id, name: name.trim(), instructions: '', documentIds: [], createdAt: Date.now() }], selectedProjectId: id }));
    return id;
  },
  updateProject: (id, patch) => set(state => ({ projects: state.projects.map(project => project.id === id ? { ...project, ...patch, name: patch.name?.trim() || project.name } : project) })),
  deleteProject: (id) => set(state => ({ projects: state.projects.filter(project => project.id !== id), selectedProjectId: state.selectedProjectId === id ? undefined : state.selectedProjectId })),
}), { name: 'zaylo-projects-v1', partialize: state => ({ projects: state.projects, selectedProjectId: state.selectedProjectId }) }));
