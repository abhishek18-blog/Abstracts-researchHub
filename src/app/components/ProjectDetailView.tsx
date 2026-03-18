import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, BookOpen, Plus, Trash2, Search, Loader2, X,
  FileText, Users, Calendar, ExternalLink, BarChart3, Clock
} from 'lucide-react';
import { projectsApi, papersApi, type Project, type Paper } from '../services/api';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';

interface ProjectDetailViewProps {
  projectId: string;
  onBack: () => void;
}

export function ProjectDetailView({ projectId, onBack }: ProjectDetailViewProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [allPapers, setAllPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPaper, setShowAddPaper] = useState(false);
  const [paperSearch, setPaperSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      const res = await projectsApi.getById(projectId);
      setProject(res.data);
      setPapers(res.data.papers || []);
    } catch (err) {
      console.error('Failed to fetch project:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  useEffect(() => {
    papersApi.getAll().then(r => setAllPapers(r.data)).catch(() => {});
  }, []);

  // Load notes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`project-notes-${projectId}`);
    if (saved) setNotes(saved);
  }, [projectId]);

  const saveNotes = (val: string) => {
    setNotes(val);
    localStorage.setItem(`project-notes-${projectId}`, val);
  };

  const handleAddPaper = async (paperId: string) => {
    setAdding(paperId);
    try {
      await projectsApi.addPaper(projectId, paperId);
      await fetchProject();
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(null);
    }
  };

  const handleRemovePaper = async (paperId: string) => {
    setRemoving(paperId);
    try {
      await projectsApi.removePaper(projectId, paperId);
      setPapers(prev => prev.filter(p => p.id !== paperId));
      setProject(prev => prev ? { ...prev, paperCount: Math.max(0, prev.paperCount - 1) } : prev);
    } catch (err) {
      console.error(err);
    } finally {
      setRemoving(null);
    }
  };

  const paperIds = new Set(papers.map(p => p.id));
  const addablePapers = allPapers.filter(p =>
    !paperIds.has(p.id) &&
    (!paperSearch.trim() ||
      p.title.toLowerCase().includes(paperSearch.toLowerCase()) ||
      p.authors.some(a => a.toLowerCase().includes(paperSearch.toLowerCase())))
  );

  if (loading) {
    return (
      <div className="flex-1 bg-[#F9FAFB] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1E40AF] animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 bg-[#F9FAFB] flex items-center justify-center">
        <p className="text-[#6B7280]">Project not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#F9FAFB] overflow-y-auto">
      <div className="max-w-5xl mx-auto p-8">
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] mb-6 transition-colors text-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Projects
        </button>

        {/* Project Header */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 mb-6">
          <div className="flex items-start gap-5">
            <div className={`w-16 h-16 rounded-2xl ${project.color} flex items-center justify-center shadow-md flex-shrink-0`}>
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-[#111827]">{project.name}</h1>
              {project.description && (
                <p className="text-[#6B7280] mt-1">{project.description}</p>
              )}

              {/* Stats Row */}
              <div className="flex items-center gap-6 mt-4">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-[#6B7280]" />
                  <span className="font-semibold text-[#111827]">{project.paperCount}</span>
                  <span className="text-[#6B7280]">papers</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <BarChart3 className="w-4 h-4 text-[#6B7280]" />
                  <span className="font-semibold text-[#111827]">{project.progress}%</span>
                  <span className="text-[#6B7280]">progress</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-[#6B7280]" />
                  <span className="text-[#6B7280]">Created {new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <Progress value={project.progress} className="h-2" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Papers Column (2/3) */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#111827]">Papers ({papers.length})</h2>
              <button
                onClick={() => setShowAddPaper(true)}
                className="flex items-center gap-2 px-3 py-2 bg-[#1E40AF] text-white text-sm font-medium rounded-lg hover:bg-[#1E3A8A] transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Paper
              </button>
            </div>

            {papers.length === 0 ? (
              <div className="bg-white border border-dashed border-[#D1D5DB] rounded-xl p-8 text-center">
                <BookOpen className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
                <p className="text-[#6B7280] mb-3">No papers added yet</p>
                <button
                  onClick={() => setShowAddPaper(true)}
                  className="px-4 py-2 bg-[#EFF6FF] text-[#1E40AF] text-sm font-medium rounded-lg hover:bg-[#DBEAFE]"
                >
                  + Add your first paper
                </button>
              </div>
            ) : (
              papers.map(paper => (
                <div key={paper.id} className="bg-white border border-[#E5E7EB] rounded-xl p-5 hover:shadow-sm transition-shadow group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {paper.tags?.map((tag, i) => (
                          <Badge
                            key={i}
                            className={
                              tag === 'Highly Cited'
                                ? 'bg-[#FEF3C7] text-[#92400E] text-[10px]'
                                : tag === 'PDF Available'
                                ? 'bg-[#D1FAE5] text-[#065F46] text-[10px]'
                                : 'bg-[#E5E7EB] text-[#374151] text-[10px]'
                            }
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <h3 className="font-semibold text-[#111827] text-sm leading-snug line-clamp-2">{paper.title}</h3>

                      <div className="flex items-center gap-3 mt-2 text-xs text-[#6B7280]">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {paper.authors.slice(0, 2).join(', ')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {paper.year}
                        </span>
                        <span>{paper.citations.toLocaleString()} citations</span>
                      </div>

                      {/* Reading progress */}
                      {paper.readingProgress !== undefined && paper.readingProgress > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-[#6B7280] mb-1">
                            <span>Reading Progress</span>
                            <span className="font-medium text-[#1E40AF]">{paper.readingProgress}%</span>
                          </div>
                          <Progress value={paper.readingProgress} className="h-1.5" />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-3">
                        {(paper.source_url || paper.pdf_url) && (
                          <a
                            href={paper.source_url || paper.pdf_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-[#1E40AF] hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" /> View Paper
                          </a>
                        )}
                        {paper.pdf_url && (
                          <a
                            href={paper.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-[#065F46] hover:underline"
                          >
                            📄 Open PDF
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => handleRemovePaper(paper.id)}
                      disabled={removing === paper.id}
                      className="p-2 text-[#D1D5DB] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title="Remove from project"
                    >
                      {removing === paper.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sidebar (1/3) */}
          <div className="space-y-4">
            {/* Notes */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
              <h3 className="font-semibold text-[#111827] mb-3 text-sm flex items-center gap-2">
                📝 Research Notes
              </h3>
              <textarea
                value={notes}
                onChange={e => saveNotes(e.target.value)}
                placeholder="Write notes, observations, key findings, or to-dos for this project..."
                rows={8}
                className="w-full px-3 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#60A5FA] text-sm text-[#374151] placeholder-[#9CA3AF] resize-none leading-relaxed"
              />
              <p className="text-[10px] text-[#9CA3AF] mt-1.5">Auto-saved locally</p>
            </div>

            {/* Quick Stats */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
              <h3 className="font-semibold text-[#111827] mb-3 text-sm">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Total citations</span>
                  <span className="font-semibold text-[#111827]">{papers.reduce((a, p) => a + (p.citations || 0), 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">With PDF</span>
                  <span className="font-semibold text-[#111827]">{papers.filter(p => p.pdf_url).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Avg. progress</span>
                  <span className="font-semibold text-[#1E40AF]">{project.progress}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Year range</span>
                  <span className="font-semibold text-[#111827]">
                    {papers.length > 0
                      ? `${Math.min(...papers.map(p => parseInt(p.year) || 9999))}–${Math.max(...papers.map(p => parseInt(p.year) || 0))}`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Paper Modal */}
      {showAddPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowAddPaper(false); setPaperSearch(''); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] flex-shrink-0">
              <h3 className="font-semibold text-[#111827]">Add Paper to Project</h3>
              <button onClick={() => { setShowAddPaper(false); setPaperSearch(''); }} className="p-1.5 hover:bg-[#F3F4F6] rounded-lg">
                <X className="w-4 h-4 text-[#6B7280]" />
              </button>
            </div>

            <div className="p-4 border-b border-[#E5E7EB] flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  type="text"
                  placeholder="Search papers..."
                  value={paperSearch}
                  onChange={e => setPaperSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#60A5FA] text-sm"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
              {addablePapers.length === 0 ? (
                <p className="text-center text-sm text-[#9CA3AF] py-8">
                  {paperSearch ? 'No matching papers' : 'All your papers are already in this project!'}
                </p>
              ) : (
                addablePapers.map(paper => (
                  <div key={paper.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:bg-[#F9FAFB] transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#111827] line-clamp-1">{paper.title}</p>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        {paper.authors.slice(0, 2).join(', ')} · {paper.year}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAddPaper(paper.id)}
                      disabled={adding === paper.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E40AF] text-white text-xs font-medium rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 flex-shrink-0"
                    >
                      {adding === paper.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

