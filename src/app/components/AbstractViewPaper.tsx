import { useState, useEffect, useRef } from 'react';
import { Loader2, Trash2, Copy } from 'lucide-react';
import { papersApi, AbstractHighlight } from '../services/api';

interface AbstractViewPaperProps {
  paperId: string;
}

export function AbstractViewPaper({ paperId }: AbstractViewPaperProps) {
  const [fullAbstract, setFullAbstract] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [highlights, setHighlights] = useState<AbstractHighlight[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ top: number; left: number } | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<{ id: string, text: string, top: number, left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch the specific paper details to get the full abstract
        const [paperRes, highlightsRes] = await Promise.all([
          papersApi.getById(paperId),
          papersApi.getHighlights(paperId)
        ]);

        if (isMounted) {
          if (paperRes.data && paperRes.data.abstract) {
            setFullAbstract(paperRes.data.abstract);
          } else {
            setFullAbstract('No abstract available for this paper.');
          }

          if (highlightsRes.success) {
            setHighlights(highlightsRes.data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch abstract or highlights:', err);
        if (isMounted) setFullAbstract('Failed to load the full abstract.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (paperId) {
      fetchData();
    }
    return () => { isMounted = false; };
  }, [paperId]);

  const handleSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionRange(null);
      setSelectedText('');
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 3) {
      setSelectionRange(null);
      return;
    }

    if (containerRef.current && containerRef.current.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionRange({
        top: rect.top - 40,
        left: rect.left + rect.width / 2,
      });
      setSelectedText(text);
    } else {
      setSelectionRange(null);
      setSelectedText('');
    }
  };

  const handleAddHighlight = async (color: string = 'yellow') => {
    if (!selectedText) return;
    try {
      const res = await papersApi.addHighlight(paperId, selectedText, color);
      if (res.success && res.data) {
        setHighlights(prev => [...prev, res.data]);
      }
      setSelectionRange(null);
      window.getSelection()?.removeAllRanges();
    } catch (err) {
      console.error('Failed to add highlight', err);
    }
  };

  const handleRemoveHighlight = async (highlightId: string) => {
    try {
      await papersApi.removeHighlight(paperId, highlightId);
      setHighlights(prev => prev.filter(h => h.id !== highlightId));
    } catch (err) {
      console.error('Failed to remove highlight', err);
    }
  };

  const renderAbstract = () => {
    if (!fullAbstract) return null;
    let parts: { text: string; highlight?: AbstractHighlight }[] = [{ text: fullAbstract }];

    highlights.forEach(h => {
      const newParts: typeof parts = [];
      parts.forEach(part => {
        if (part.highlight) {
          newParts.push(part);
        } else {
          const split = part.text.split(h.text);
          split.forEach((s, idx) => {
            newParts.push({ text: s });
            if (idx < split.length - 1) {
              newParts.push({ text: h.text, highlight: h });
            }
          });
        }
      });
      parts = newParts;
    });

    return parts.map((part, index) => {
      if (part.highlight) {
        const bgClass = part.highlight.color === 'green' 
          ? 'bg-green-200/80 hover:bg-green-300 dark:bg-green-500/30 dark:hover:bg-green-500/50 text-green-900 dark:text-green-100'
          : part.highlight.color === 'blue'
          ? 'bg-blue-200/80 hover:bg-blue-300 dark:bg-blue-500/30 dark:hover:bg-blue-500/50 text-blue-900 dark:text-blue-100'
          : 'bg-yellow-200/80 hover:bg-yellow-300 dark:bg-yellow-500/30 dark:hover:bg-yellow-500/50 text-yellow-900 dark:text-yellow-100';

        return (
          <mark 
            key={index} 
            className={`group relative cursor-pointer rounded-sm px-1 py-0.5 transition-colors ${bgClass}`}
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setActiveHighlight({
                id: part.highlight!.id,
                text: part.highlight!.text,
                top: rect.top - 40,
                left: rect.left + rect.width / 2,
              });
              setSelectionRange(null);
            }}
            title="Click for options"
          >
            {part.text}
          </mark>
        );
      }
      return <span key={index}>{part.text}</span>;
    });
  };

  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (activeHighlight) {
        setActiveHighlight(null);
      }
      if (selectionRange) {
        // tiny delay to allow clicking buttons
        setTimeout(() => {
          if (window.getSelection()?.isCollapsed) {
            setSelectionRange(null);
            setSelectedText('');
          }
        }, 150);
      }
    };
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [selectionRange, activeHighlight]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground text-sm italic border-l-2 border-primary/20 pl-4 py-3 bg-muted/10 rounded-r-xl my-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        Fetching full abstract...
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col gap-4 my-2" 
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()} // prevent card drag
    >
      <div 
        ref={containerRef}
        className="relative text-sm text-foreground leading-relaxed border-l-2 border-primary/40 pl-4 py-3 bg-card border rounded-r-xl shadow-inner"
        onMouseUp={handleSelection}
      >
        <div className="italic pt-2 pb-2 selection:bg-primary/20 relative">
          "{renderAbstract()}"
        </div>
        
        {selectionRange && (
          <div 
            className="fixed z-50 flex items-center gap-1 p-1 bg-background border rounded-md shadow-lg animate-in fade-in duration-200"
            style={{ 
              top: selectionRange.top, 
              left: selectionRange.left,
              transform: 'translateX(-50%)'
            }}
            onMouseDown={(e) => e.preventDefault()} // prevent text unselection
          >
            <div className="flex items-center text-xs font-semibold px-2 py-1 text-muted-foreground uppercase tracking-wide">
              Highlight
            </div>
            <div className="h-4 w-[1px] bg-border mx-1"></div>
            <button
              onClick={() => handleAddHighlight('yellow')}
              className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-400 hover:bg-yellow-500 shadow-sm border border-yellow-500 transition-transform hover:scale-110"
              title="Highlight yellow"
            />
            <button
              onClick={() => handleAddHighlight('green')}
              className="flex items-center justify-center w-6 h-6 rounded-full bg-green-400 hover:bg-green-500 shadow-sm border border-green-500 transition-transform hover:scale-110"
              title="Highlight green"
            />
            <button
              onClick={() => handleAddHighlight('blue')}
              className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-400 hover:bg-blue-500 shadow-sm border border-blue-500 transition-transform hover:scale-110"
              title="Highlight blue"
            />
          </div>
        )}

        {activeHighlight && (
          <div 
            className="fixed z-50 flex items-center gap-1 p-1 bg-background border rounded-md shadow-lg animate-in fade-in zoom-in duration-200"
            style={{ 
              top: activeHighlight.top, 
              left: activeHighlight.left,
              transform: 'translateX(-50%)'
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                navigator.clipboard.writeText(activeHighlight.text);
                setActiveHighlight(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold hover:bg-muted text-foreground transition-colors rounded-sm"
              title="Copy text"
            >
              <Copy className="w-3.5 h-3.5 text-muted-foreground" /> Copy
            </button>
            <div className="h-4 w-[1px] bg-border mx-1"></div>
            <button
              onClick={() => {
                handleRemoveHighlight(activeHighlight.id);
                setActiveHighlight(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors rounded-sm"
              title="Delete highlight"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}
      </div>

      {highlights.length > 0 && (
        <div className="flex flex-col gap-2 p-3 bg-muted/20 border rounded-lg mt-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            Your Highlights 
            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px]">{highlights.length}</span>
          </h4>
          <ul className="space-y-2 mt-1">
            {highlights.map((h) => (
              <li key={h.id} className="text-sm flex gap-2 items-start group">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" 
                     style={ h.color === 'yellow' ? { backgroundColor: '#facc15' } : 
                             h.color === 'green' ? { backgroundColor: '#4ade80' } : 
                             h.color === 'blue' ? { backgroundColor: '#60a5fa' } : {} } />
                <span className="flex-1 line-clamp-3 text-foreground transition-colors italic">
                  "{h.text}"
                </span>
                <button
                  onClick={() => handleRemoveHighlight(h.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all shrink-0"
                  title="Remove highlight"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
