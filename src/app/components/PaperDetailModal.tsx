import { useState, useEffect } from 'react';
import { X, Users, Calendar, FileText, ExternalLink, Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { CitationToggle } from './CitationToggle';
import { papersApi, type Paper } from '../services/api';

interface PaperDetailModalProps {
  paperId: string | null;
  onClose: () => void;
}

export function PaperDetailModal({ paperId, onClose }: PaperDetailModalProps) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!paperId) return;
    const fetchPaper = async () => {
      setLoading(true);
      try {
        const response = await papersApi.getById(paperId);
        setPaper(response.data);
        setProgress(response.data.readingProgress || 0);
      } catch (err) {
        console.error('Failed to fetch paper:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPaper();
  }, [paperId]);

  const handleToggleSave = async () => {
    if (!paper) return;
    try {
      const response = await papersApi.toggleSave(paper.id);
      setPaper(prev => prev ? { ...prev, saved: response.data.saved } : prev);
    } catch (err) {
      console.error('Failed to toggle save:', err);
    }
  };

  const handleProgressChange = async (newProgress: number) => {
    if (!paper) return;
    setProgress(newProgress);
    try {
      await papersApi.updateProgress(paper.id, newProgress);
    } catch (err) {
      console.error('Failed to update progress:', err);
    }
  };

  if (!paperId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4 animate-in fade-in zoom-in-95 duration-200">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#1E40AF] animate-spin" />
          </div>
        ) : paper ? (
          <>
            {/* Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-[#E5E7EB] px-8 py-5 flex items-start justify-between z-10">
              <div className="flex-1 pr-4">
                <div className="flex flex-wrap gap-2 mb-3">
                  {paper.tags.map((tag, i) => {
                    const isPdf = tag === 'PDF Available' && paper.pdf_url;
                    const cls =
                      tag === 'Highly Cited'
                        ? 'bg-[#FEF3C7] text-[#92400E]'
                        : tag === 'New'
                        ? 'bg-[#DBEAFE] text-[#1E40AF]'
                        : 'bg-[#D1FAE5] text-[#065F46]';
                    return isPdf ? (
                      <a key={i} href={paper.pdf_url!} target="_blank" rel="noopener noreferrer">
                        <Badge className={`${cls} cursor-pointer hover:opacity-80`}>📄 {tag}</Badge>
                      </a>
                    ) : (
                      <Badge key={i} className={cls}>{tag}</Badge>
                    );
                  })}
                </div>
                <h2 className="text-xl font-bold text-[#111827] leading-snug">{paper.title}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>

            {/* Body */}
            <div className="px-8 py-6 space-y-6">
              {/* Authors */}
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-[#6B7280] mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#374151]">Authors</p>
                  <p className="text-sm text-[#6B7280]">{paper.authors.join(', ')}</p>
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#6B7280]" />
                  <span className="text-sm text-[#374151] font-medium">{paper.year}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#6B7280]" />
                  <span className="text-sm text-[#374151] font-medium">{paper.citations.toLocaleString()} citations</span>
                </div>
              </div>

              {/* Abstract */}
              <div>
                <h3 className="text-sm font-semibold text-[#111827] mb-2">Abstract</h3>
                <p className="text-sm text-[#4B5563] leading-relaxed">{paper.abstract}</p>
              </div>

              {/* Reading Progress */}
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#111827]">Reading Progress</h3>
                  <span className="text-sm font-medium text-[#1E40AF]">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3 mb-4" />
                <div className="flex gap-2">
                  {[0, 25, 50, 75, 100].map((val) => (
                    <button
                      key={val}
                      onClick={() => handleProgressChange(val)}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                        progress === val
                          ? 'bg-[#1E40AF] text-white'
                          : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-[#1E40AF] hover:text-[#1E40AF]'
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Citation Toggle */}
              <CitationToggle
                paperTitle={paper.title}
                authors={paper.authors}
                year={paper.year}
              />

              {/* Actions */}
              <div className="flex items-center flex-wrap gap-3 pt-4 border-t border-[#E5E7EB]">
                {paper.source_url && (
                  <a
                    href={paper.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#1E40AF] text-white rounded-lg hover:bg-[#1E3A8A] transition-colors text-sm font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on Web
                  </a>
                )}
                {paper.pdf_url && (
                  <a
                    href={paper.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#065F46] text-white rounded-lg hover:bg-[#047857] transition-colors text-sm font-medium"
                  >
                    📄 Open PDF
                  </a>
                )}
                {!paper.source_url && !paper.pdf_url && (
                  <span className="text-sm text-[#9CA3AF] italic">No external link available</span>
                )}
                <button
                  onClick={handleToggleSave}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    paper.saved
                      ? 'bg-[#DBEAFE] text-[#1E40AF] hover:bg-[#BFDBFE]'
                      : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
                  }`}
                >
                  {paper.saved ? (
                    <BookmarkCheck className="w-4 h-4 fill-current" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                  {paper.saved ? 'Saved' : 'Save Paper'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="py-20 text-center text-[#6B7280]">Paper not found</div>
        )}
      </div>
    </div>
  );
}
