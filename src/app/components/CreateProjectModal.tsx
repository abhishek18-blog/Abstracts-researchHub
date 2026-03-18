import { useState, useEffect } from 'react';
import { X, FolderOpen, Loader2, Plus, BookOpen, Trash2, Calendar, Tag, Search } from 'lucide-react';
import { projectsApi, papersApi, type Paper } from '../services/api';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const colorOptions = [
  { value: 'bg-blue-500', label: 'Blue', hex: '#3B82F6' },
  { value: 'bg-purple-500', label: 'Purple', hex: '#8B5CF6' },
  { value: 'bg-green-500', label: 'Green', hex: '#22C55E' },
  { value: 'bg-red-500', label: 'Red', hex: '#EF4444' },
  { value: 'bg-yellow-500', label: 'Yellow', hex: '#EAB308' },
  { value: 'bg-pink-500', label: 'Pink', hex: '#EC4899' },
  { value: 'bg-indigo-500', label: 'Indigo', hex: '#6366F1' },
  { value: 'bg-teal-500', label: 'Teal', hex: '#14B8A6' },
];

export function CreateProjectModal({ isOpen, onClose, onCreated }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('bg-blue-500');
  const [deadline, setDeadline] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedPapers, setSelectedPapers] = useState<string[]>([]);
  const [allPapers, setAllPapers] = useState<Paper[]>([]);
  const [paperSearch, setPaperSearch] = useState('');
  const [showPaperPicker, setShowPaperPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1); // 1 = basics, 2 = add papers

  useEffect(() => {
    if (isOpen) {
      papersApi.getAll().then(r => setAllPapers(r.data)).catch(() => {});
    }
  }, [isOpen]);

  const handleReset = () => {
    setName(''); setDescription(''); setColor('bg-blue-500');
    setDeadline(''); setTags([]); setTagInput('');
    setSelectedPapers([]); setPaperSearch(''); setStep(1);
    setError(null);
  };

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags(prev => [...prev, t]);
    }
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
  };

  const togglePaper = (id: string) => {
    setSelectedPapers(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const filteredPapers = allPapers.filter(p =>
    !paperSearch.trim() ||
    p.title.toLowerCase().includes(paperSearch.toLowerCase()) ||
    p.authors.some(a => a.toLowerCase().includes(paperSearch.toLowerCase()))
  );

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await projectsApi.create({
        name: name.trim(),
        description: description.trim(),
        color,
      });

      // Add selected papers to the project
      for (const paperId of selectedPapers) {
        try {
          await projectsApi.addPaper(res.data.id, paperId);
        } catch { /* ignore if paper add fails */ }
      }

      handleReset();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">Create Research Project</h2>
              <p className="text-xs text-[#9CA3AF]">Step {step} of 2 — {step === 1 ? 'Project details' : 'Add papers'}</p>
            </div>
          </div>
          <button onClick={() => { handleReset(); onClose(); }} className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors">
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 px-6 pt-4 flex-shrink-0">
          <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-[#1E40AF]' : 'bg-[#E5E7EB]'}`}></div>
          <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-[#1E40AF]' : 'bg-[#E5E7EB]'}`}></div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Machine Learning for Drug Discovery"
                  className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#60A5FA] text-[#111827] placeholder-[#9CA3AF]"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this research project about? Describe its goals and scope..."
                  rows={3}
                  className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#60A5FA] text-[#111827] placeholder-[#9CA3AF] resize-none"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  Color Theme
                </label>
                <div className="flex gap-3 flex-wrap">
                  {colorOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setColor(opt.value)}
                      className={`w-10 h-10 rounded-lg transition-all ${opt.value} ${
                        color === opt.value
                          ? 'ring-2 ring-offset-2 ring-[#1E40AF] scale-110'
                          : 'hover:scale-105 opacity-70 hover:opacity-100'
                      }`}
                      title={opt.label}
                    />
                  ))}
                </div>
              </div>

              {/* Deadline */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-[#374151] mb-1.5">
                  <Calendar className="w-4 h-4" /> Deadline (optional)
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#60A5FA] text-[#111827] cursor-pointer"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-[#374151] mb-1.5">
                  <Tag className="w-4 h-4" /> Tags
                </label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-[#EFF6FF] text-[#1E40AF] text-sm rounded-full">
                      {tag}
                      <button onClick={() => setTags(prev => prev.filter(t => t !== tag))} className="hover:text-red-500 ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Type tag and press Enter..."
                    className="flex-1 px-4 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#60A5FA] text-sm text-[#111827] placeholder-[#9CA3AF]"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    disabled={!tagInput.trim()}
                    className="px-3 py-2 bg-[#EFF6FF] text-[#1E40AF] rounded-lg hover:bg-[#DBEAFE] text-sm font-medium disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Step 2: Add Papers */
            <div className="space-y-4">
              <p className="text-sm text-[#6B7280]">
                Select papers from your library to include in this project. You can always add more later.
              </p>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={paperSearch}
                  onChange={e => setPaperSearch(e.target.value)}
                  placeholder="Search your papers..."
                  className="w-full pl-9 pr-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#60A5FA] text-sm text-[#111827] placeholder-[#9CA3AF]"
                />
              </div>

              {/* Selected count */}
              {selectedPapers.length > 0 && (
                <div className="px-3 py-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg text-sm text-[#1E40AF] font-medium">
                  ✓ {selectedPapers.length} paper{selectedPapers.length > 1 ? 's' : ''} selected
                </div>
              )}

              {/* Papers list */}
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {filteredPapers.length === 0 ? (
                  <p className="text-center text-sm text-[#9CA3AF] py-8">No papers found in your library</p>
                ) : (
                  filteredPapers.map(paper => {
                    const isSelected = selectedPapers.includes(paper.id);
                    return (
                      <button
                        key={paper.id}
                        onClick={() => togglePaper(paper.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-[#1E40AF] bg-[#EFF6FF]'
                            : 'border-[#E5E7EB] bg-white hover:border-[#93C5FD] hover:bg-[#F9FAFB]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected ? 'bg-[#1E40AF] border-[#1E40AF]' : 'border-[#D1D5DB]'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#111827] line-clamp-1">{paper.title}</p>
                            <p className="text-xs text-[#6B7280] mt-0.5">
                              {paper.authors.slice(0, 2).join(', ')} · {paper.year} · {paper.citations.toLocaleString()} citations
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#E5E7EB] flex-shrink-0 bg-[#F9FAFB]">
          {step === 1 ? (
            <>
              <button type="button" onClick={() => { handleReset(); onClose(); }} className="px-4 py-2.5 text-sm text-[#6B7280] hover:bg-[#E5E7EB] rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!name.trim()) { setError('Project name is required'); return; }
                  setError(null);
                  setStep(2);
                }}
                className="px-5 py-2.5 bg-[#1E40AF] text-white text-sm font-medium rounded-lg hover:bg-[#1E3A8A] transition-colors"
              >
                Next: Add Papers →
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="px-4 py-2.5 text-sm text-[#6B7280] hover:bg-[#E5E7EB] rounded-lg transition-colors">
                ← Back
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#E5E7EB] text-[#374151] text-sm font-medium rounded-lg hover:bg-[#D1D5DB] transition-colors disabled:opacity-50"
                >
                  Skip & Create
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || selectedPapers.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#1E40AF] text-white text-sm font-medium rounded-lg hover:bg-[#1E3A8A] transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create with {selectedPapers.length} paper{selectedPapers.length !== 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
