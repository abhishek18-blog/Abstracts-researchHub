import { useState } from 'react';
import { FileText, Users, Calendar, ExternalLink, Bookmark, BookmarkCheck, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { AbstractViewPaper } from './AbstractViewPaper';

interface ResearchPaperCardProps {
  id: string;
  title: string;
  authors: string[];
  year: string;
  citations: number;
  tags: string[];
  abstract: string;
  readingProgress?: number;
  saved?: boolean;
  pdf_url?: string | null;
  source_url?: string | null;
  onPaperClick?: () => void;
  onToggleSave?: () => void;
  onDelete?: (id: string) => void;
}

export function ResearchPaperCard({
  id,
  title,
  authors,
  year,
  citations,
  tags,
  abstract,
  readingProgress,
  saved = false,
  pdf_url,
  source_url,
  onPaperClick,
  onToggleSave,
  onDelete,
}: ResearchPaperCardProps) {
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);

  return (
    <div
      className="bg-card border border-primary/10 rounded-2xl p-6 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer relative group/card border-l-4 border-l-transparent hover:border-l-primary"
      onClick={onPaperClick}
    >
      {/* Delete button (Top Right) */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Are you sure you want to permanently delete this paper from the database? This action cannot be undone.')) {
              onDelete(id);
            }
          }}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all opacity-0 group-hover/card:opacity-100 z-10"
          title="Delete Paper"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-4 mr-8">
        {tags.map((tag, index) => {
          const isPdf = tag === 'PDF Available';
          const pdfLink = isPdf && pdf_url ? pdf_url : null;
          const badgeClass =
            tag === 'Highly Cited'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/50'
              : tag === 'New'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200/50'
                : isPdf
                  ? `bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200/50 ${pdfLink ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}`
                  : 'bg-muted text-muted-foreground border-transparent';

          const content = (
            <Badge key={index} variant="outline" className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
              {isPdf ? '📄 ' : ''}{tag}
            </Badge>
          );

          return pdfLink ? (
            <a
              key={index}
              href={pdfLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {content}
            </a>
          ) : content;
        })}
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-foreground mb-3 line-clamp-2 group-hover/card:text-primary transition-colors leading-tight">
        {title}
      </h3>

      {/* Authors */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
        <Users className="w-4 h-4 text-primary/60" />
        <span className="font-medium line-clamp-1">{authors.join(', ')}</span>
      </div>

      {/* Meta Info */}
      <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground mb-5 uppercase tracking-wide">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md tracking-normal">
          <Calendar className="w-3.5 h-3.5 text-primary/60" />
          <span>{year}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md tracking-normal">
          <FileText className="w-3.5 h-3.5 text-primary/60" />
          <span>{citations.toLocaleString()} <span className="text-[10px] opacity-60 ml-0.5">Citations</span></span>
        </div>
      </div>

      {/* Abstract */}
      <div className="mb-6">
        {!isAbstractExpanded ? (
          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed italic border-l-2 border-primary/20 pl-4 py-1">
            "{abstract}"
          </p>
        ) : (
          <AbstractViewPaper paperId={id} />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsAbstractExpanded(!isAbstractExpanded);
          }}
          className="mt-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          {isAbstractExpanded ? (
            <>
              Hide Abstract <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              View Abstract <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      </div>

      {/* Reading Progress */}
      {readingProgress !== undefined && (
        <div className="mb-6 bg-muted/30 p-3 rounded-xl border border-border/50">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter text-muted-foreground mb-2">
            <span>Reading Progress</span>
            <span className="text-primary font-black">{readingProgress}%</span>
          </div>
          <Progress value={readingProgress} className="h-1.5" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4 border-t border-border">
        {source_url || pdf_url ? (
          <a
            href={source_url || pdf_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 text-xs font-bold text-primary hover:opacity-80 transition-all uppercase tracking-widest"
          >
            <ExternalLink className="w-4 h-4" />
            View Full Paper
          </a>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onPaperClick?.(); }}
            className="flex items-center gap-2 text-xs font-bold text-primary hover:opacity-80 transition-all uppercase tracking-widest"
          >
            <ExternalLink className="w-4 h-4" />
            Paper Details
          </button>
        )}
        <div className="flex-1"></div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave?.();
          }}
          className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all px-4 py-2 rounded-xl border ${saved
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'text-muted-foreground hover:bg-muted border-transparent hover:border-border'
            }`}
        >
          {saved ? (
            <BookmarkCheck className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Bookmark className="w-3.5 h-3.5" />
          )}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}
