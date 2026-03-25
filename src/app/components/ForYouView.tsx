import { useState, useEffect, useRef, useCallback } from 'react';
import { Newspaper, ChevronLeft, ChevronRight, RefreshCw, ArrowRight, Loader2, BookmarkPlus, Check, ExternalLink, FileText, Calendar, Settings, Search } from 'lucide-react';
import { searchApi, type ExternalPaper } from '../services/api';

interface ForYouViewProps {
  userInterests: string[];
  onGoToSettings?: () => void;
}

type InterestFeed = { interest: string; papers: ExternalPaper[]; loading: boolean; error: boolean };

export function ForYouView({ userInterests, onGoToSettings }: ForYouViewProps) {
  const [feeds, setFeeds] = useState<InterestFeed[]>([]);
  const [fetched, setFetched] = useState(false);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [importingId, setImportingId] = useState<string | null>(null);

  const loadFeeds = useCallback(() => {
    if (userInterests.length === 0) return;
    setFetched(true);
    setFeeds(userInterests.map(interest => ({ interest, papers: [], loading: true, error: false })));

    // Fire all requests in parallel
    userInterests.forEach(async (interest, idx) => {
      try {
        const res = await searchApi.searchPapers(interest, 6, 0);
        setFeeds(prev => prev.map((f, i) =>
          i === idx ? { ...f, papers: res.data, loading: false } : f
        ));
      } catch {
        setFeeds(prev => prev.map((f, i) =>
          i === idx ? { ...f, loading: false, error: true } : f
        ));
      }
    });
  }, [userInterests]);

  useEffect(() => {
    if (!fetched) loadFeeds();
  }, [fetched, loadFeeds]);

  const handleImport = async (paper: ExternalPaper) => {
    setImportingId(paper.externalId);
    try {
      await searchApi.importPaper(paper);
      setImportedIds(prev => new Set([...prev, paper.externalId]));
    } catch (err: any) {
      if (err.message?.includes('already')) {
        setImportedIds(prev => new Set([...prev, paper.externalId]));
      } else {
        alert(err.message || 'Failed to import paper');
      }
    } finally {
      setImportingId(null);
    }
  };

  const handleSearchMore = (interest: string) => {
    window.dispatchEvent(new CustomEvent('openDiscoverTab'));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('searchDiscover', { detail: interest }));
    }, 300);
  };

  if (userInterests.length === 0) {
    return (
      <div className="flex-1 bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-8">
          <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Newspaper className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">No interests set yet</h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Pick up to 4 research domains in Settings to get a personalized daily feed of the latest papers just for you.
          </p>
          <button
            onClick={onGoToSettings}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-semibold hover:opacity-90 transition-all mx-auto"
          >
            <Settings className="w-5 h-5" /> Set My Interests
          </button>
        </div>
      </div>
    );
  }

  const allLoaded = feeds.every(f => !f.loading);

  return (
    <div className="flex-1 bg-background overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8 animate-in fade-in duration-500">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2.5">
              <Newspaper className="w-6 h-6 text-primary" />
              What's New For You
            </h2>
            <p className="text-sm text-muted-foreground">
              Latest papers across{' '}
              <span className="text-primary font-semibold">{userInterests.length}</span>{' '}
              of your interests
              {!allLoaded && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => { setFetched(false); setFeeds([]); }}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-primary hover:border-primary/50 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Interest feeds */}
        <div className="space-y-10">
          {feeds.map((feed) => (
            <FeedSection
              key={feed.interest}
              feed={feed}
              importedIds={importedIds}
              importingId={importingId}
              onImport={handleImport}
              onSeeAll={handleSearchMore}
            />
          ))}
        </div>

      </div>
    </div>
  );
}

// ── Shimmer skeleton card ─────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-72 rounded-2xl border border-border overflow-hidden"
      style={{ background: 'var(--card)' }}>
      <div className="p-5 space-y-3">
        {/* Year badge placeholder */}
        <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
        {/* Title lines */}
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-muted animate-pulse" />
          <div className="h-4 w-4/5 rounded bg-muted animate-pulse" />
          <div className="h-4 w-3/5 rounded bg-muted animate-pulse" />
        </div>
        {/* Meta */}
        <div className="h-3 w-24 rounded bg-muted animate-pulse" />
        {/* Abstract lines */}
        <div className="space-y-1.5 pt-1">
          <div className="h-3 w-full rounded bg-muted animate-pulse opacity-70" />
          <div className="h-3 w-full rounded bg-muted animate-pulse opacity-70" />
          <div className="h-3 w-2/3 rounded bg-muted animate-pulse opacity-70" />
        </div>
        {/* Action button */}
        <div className="h-8 w-full rounded-xl bg-muted animate-pulse mt-2" />
      </div>
    </div>
  );
}

// ── Feed section per interest ─────────────────────────────────────────────────
function FeedSection({
  feed, importedIds, importingId, onImport, onSeeAll,
}: {
  feed: InterestFeed;
  importedIds: Set<string>;
  importingId: string | null;
  onImport: (paper: ExternalPaper) => void;
  onSeeAll: (interest: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -310 : 310, behavior: 'smooth' });
  };

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
          <h3 className="text-base font-semibold text-foreground">{feed.interest}</h3>
          {!feed.loading && !feed.error && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {feed.papers.length} papers
            </span>
          )}
          {feed.loading && (
            <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSeeAll(feed.interest)}
            className="flex items-center gap-1 text-sm text-primary font-medium hover:underline mr-1"
          >
            See all <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => scroll('left')} className="p-1.5 rounded-lg bg-card border border-border hover:border-primary/40 transition-all">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => scroll('right')} className="p-1.5 rounded-lg bg-card border border-border hover:border-primary/40 transition-all">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Skeleton */}
      {feed.loading && (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Error state */}
      {feed.error && (
        <div className="py-6 text-center text-muted-foreground bg-card/50 border border-dashed border-border rounded-2xl">
          <Search className="w-7 h-7 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Could not load papers for this topic.</p>
        </div>
      )}

      {/* Paper Cards */}
      {!feed.loading && !feed.error && (
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-3 scroll-smooth"
          style={{ scrollbarWidth: 'none' }}
        >
          {feed.papers.map((paper) => {
            const isImported = importedIds.has(paper.externalId);
            const isSaving = importingId === paper.externalId;
            return (
              <div
                key={paper.externalId}
                className="flex-shrink-0 w-72 bg-card border border-border rounded-2xl p-5 flex flex-col gap-2.5 hover:border-primary/40 hover:shadow-md transition-all duration-200 group"
              >
                {paper.year && paper.year !== 'N/A' && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full w-fit">
                    <Calendar className="w-3 h-3" /> {paper.year}
                  </span>
                )}

                <h4 className="text-sm font-semibold text-foreground leading-snug line-clamp-3 group-hover:text-primary transition-colors">
                  {paper.title}
                </h4>

                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="w-3 h-3 flex-shrink-0" />
                  {paper.citations.toLocaleString()} citations
                </p>

                {paper.abstract && (
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed flex-1">
                    {paper.abstract}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-2.5 border-t border-border mt-auto">
                  <button
                    onClick={() => onImport(paper)}
                    disabled={isImported || isSaving}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex-1 justify-center ${
                      isImported
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 cursor-default'
                        : 'bg-primary text-primary-foreground hover:opacity-90 active:scale-95'
                    }`}
                  >
                    {isSaving
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : isImported
                        ? <Check className="w-3 h-3" />
                        : <BookmarkPlus className="w-3 h-3" />}
                    {isImported ? 'Saved' : 'Import'}
                  </button>
                  {(paper.url || paper.pdfUrl) && (
                    <a
                      href={paper.url || paper.pdfUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/70 transition-all"
                      title="Open paper"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
