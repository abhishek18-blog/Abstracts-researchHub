import { Search, SlidersHorizontal, BookOpen, Plus, Loader2, Trash2 } from 'lucide-react';
import { ResearchPaperCard } from './ResearchPaperCard';
import { CreateProjectModal } from './CreateProjectModal';
import { ProjectDetailView } from './ProjectDetailView';
import { useState, useEffect, useCallback } from 'react';
import { Badge } from './ui/badge';
import { papersApi, projectsApi, type Paper, type Project } from '../services/api';

interface CenterFeedProps {
  activeTab: string;
  onPaperSelect?: (paperId: string) => void;
}

export function CenterFeed({ activeTab, onPaperSelect }: CenterFeedProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('most_cited');
  const [papers, setPapers] = useState<Paper[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Fetch papers from API
  const fetchPapers = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setInitialLoading(true);
      else setRefreshing(true);
      setError(null);
      const query: Record<string, string> = { sort: sortBy };
      if (searchQuery.trim()) query.search = searchQuery.trim();
      if (activeTab === 'saved') query.saved_by = 'true';
      const response = await papersApi.getAll(query);
      setPapers(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load papers');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, sortBy, activeTab]);

  // Fetch projects from API
  const fetchProjects = useCallback(async () => {
    try {
      setInitialLoading(true);
      setError(null);
      const response = await projectsApi.getAll();
      setProjects(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'projects') {
      fetchProjects();
    } else if (activeTab !== 'settings') {
      fetchPapers(true);
    }
  }, [activeTab, sortBy]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab !== 'projects' && activeTab !== 'settings') {
        fetchPapers(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleToggleSave = async (paperId: string) => {
    try {
      const response = await papersApi.toggleSave(paperId);
      const newSaved = response?.data?.saved;
      setPapers(prev => {
        const updated = prev.map(p =>
          p.id === paperId
            ? { ...p, saved: newSaved !== undefined ? newSaved : !p.saved }
            : p
        );
        if (activeTab === 'saved') {
          return updated.filter(p => p.saved);
        }
        return updated;
      });
    } catch (err) {
      console.error('Failed to toggle save:', err);
    }
  };

  const handleDeletePaper = async (paperId: string) => {
    try {
      await papersApi.delete(paperId);
      setPapers(prev => prev.filter(p => p.id !== paperId));
    } catch (err) {
      console.error('Failed to delete paper:', err);
      alert('Failed to delete paper. Please try again.');
    }
  };

  // Loading state (only on initial load)
  if (initialLoading && activeTab !== 'settings') {
    return (
      <div className="flex-1 bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <div className="absolute inset-0 bg-primary/10 rounded-full animate-pulse blur-xl"></div>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Loading your research space...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 bg-background flex items-center justify-center">
        <div className="text-center p-8 bg-card border rounded-2xl shadow-sm max-w-sm">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6" />
          </div>
          <p className="text-foreground font-bold text-lg mb-2">Something went wrong</p>
          <p className="text-muted-foreground text-sm mb-6">{error}</p>
          <button
            onClick={() => activeTab === 'projects' ? fetchProjects() : fetchPapers()}
            className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Settings tab placeholder
  if (activeTab === 'settings') {
    return null; // Handled by the Settings component in App.tsx
  }

  if (activeTab === 'projects') {
    // Show project detail view
    if (selectedProjectId) {
      return (
        <ProjectDetailView
          projectId={selectedProjectId}
          onBack={() => { setSelectedProjectId(null); fetchProjects(); }}
        />
      );
    }

    return (
      <div className="flex-1 bg-background overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">My Projects</h2>
              <p className="text-muted-foreground text-lg">Organize your research papers into curated workspaces</p>
            </div>
            <button
              onClick={() => setShowCreateProject(true)}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-primary/20"
            >
              <Plus className="w-5 h-5" />
              New Project
            </button>
          </div>

          <CreateProjectModal
            isOpen={showCreateProject}
            onClose={() => setShowCreateProject(false)}
            onCreated={fetchProjects}
          />

          {projects.length === 0 ? (
            <div className="text-center py-24 bg-card border rounded-3xl border-dashed">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-10 h-10 text-muted-foreground" />
              </div>
              <p className="text-foreground text-xl font-bold mb-2">No projects yet</p>
              <p className="text-muted-foreground mb-8">Create a project to start organizing your papers by topic or experiment</p>
              <button
                onClick={() => setShowCreateProject(true)}
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold"
              >
                Create First Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-card border border-primary/10 rounded-2xl p-6 hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden"
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 bg-gradient-to-br from-white to-transparent transform translate-x-16 -translate-y-16 rotate-45`}></div>
                  <div className="flex items-start justify-between mb-6 relative z-10">
                    <div className={`w-14 h-14 rounded-2xl ${project.color} flex items-center justify-center shadow-lg shadow-black/10`}>
                      <BookOpen className="w-7 h-7 text-white" />
                    </div>
                    <Badge variant="secondary" className="px-3 py-1 font-bold bg-muted/50 backdrop-blur-sm">{project.paperCount} Papers</Badge>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{project.name}</h3>
                  {project.description && (
                    <p className="text-sm text-muted-foreground mb-6 line-clamp-2 leading-relaxed">{project.description}</p>
                  )}
                  <div className="space-y-3 relative z-10 pt-4 border-t border-border">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <span>Research Progress</span>
                      <span className="text-primary">{project.progress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`${project.color} h-full rounded-full transition-all duration-1000 shadow-sm`}
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recently saved papers */}
          {papers.length > 0 && papers.filter(p => p.saved).length > 0 && (
            <div className="mt-12">
              <h3 className="text-xl font-semibold text-white mb-6">Recently Saved Papers</h3>
              <div className="space-y-4">
                {papers.filter(p => p.saved).slice(0, 2).map((paper) => (
                  <ResearchPaperCard
                    key={paper.id}
                    {...paper}
                    onPaperClick={() => onPaperSelect?.(paper.id)}
                    onToggleSave={() => handleToggleSave(paper.id)}
                    onDelete={handleDeletePaper}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background overflow-y-auto">
      <div className="max-w-5xl mx-auto p-8 animate-in fade-in duration-700">
        {/* Search Bar */}
        <div className="mb-10 group">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-6 h-6 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search library for papers, authors, or research topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-14 py-5 bg-card border border-primary/10 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-foreground placeholder-muted-foreground text-lg font-medium shadow-xl shadow-black/5 transition-all"
            />
            <div className="absolute right-5 top-1/2 transform -translate-y-1/2 flex items-center gap-3">
              {refreshing && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
            </div>
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-end justify-between mb-8 pb-4 border-b border-border/50">
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-3">
              {activeTab === 'saved' ? 'Saved Papers' : 'Research Library'}
              <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-xs px-2.5">{papers.length}</Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-2 font-medium">
              Browsing {activeTab === 'saved' ? 'your personal collection' : 'curated research insights'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-bold text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 cursor-pointer shadow-sm hover:border-primary transition-all"
            >
              <option value="most_cited">Most Cited</option>
              <option value="most_recent">Most Recent</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Papers List */}
        {papers.length === 0 ? (
          <div className="text-center py-24 bg-card border rounded-3xl border-dashed">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-muted-foreground opacity-50" />
            </div>
            <p className="text-foreground text-xl font-bold mb-2">No matching papers found</p>
            <p className="text-muted-foreground">Try refining your search keywords or exploring different filters</p>
          </div>
        ) : (
          <div className="space-y-6 pb-20">
            {papers.map((paper) => (
              <ResearchPaperCard
                key={paper.id}
                {...paper}
                onPaperClick={() => onPaperSelect?.(paper.id)}
                onToggleSave={() => handleToggleSave(paper.id)}
                onDelete={handleDeletePaper}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
