import { useState, useCallback, useEffect } from 'react';
import { Search, Download, ExternalLink, FileText, Users, Calendar, Loader2, BookmarkPlus, Check, Globe } from 'lucide-react';
import { searchApi, type ExternalPaper } from '../services/api';

export function DiscoverView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExternalPaper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [importingId, setImportingId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('recentSearches');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  const saveRecentSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    try {
      setRecentSearches(prev => {
        let updated = [searchQuery.trim(), ...prev.filter(s => s.toLowerCase() !== searchQuery.trim().toLowerCase())];
        updated = updated.slice(0, 4); // Keep top 4
        localStorage.setItem('recentSearches', JSON.stringify(updated));
        return updated;
      });
    } catch(e) {}
  };

  const LIMIT = 10;

  const doSearch = useCallback(async (q: string, newOffset = 0) => {
    if (!q.trim()) return;
    saveRecentSearch(q);
    
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const res = await searchApi.searchPapers(q.trim(), LIMIT, newOffset);
      if (newOffset === 0) {
        setResults(res.data);
      } else {
        setResults(prev => [...prev, ...res.data]);
      }
      setTotal((res as any).total || 0);
      setOffset(newOffset);
    } catch (err: any) {
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleRemoteSearch = async (e: any) => {
      const payload = e.detail;
      if (Array.isArray(payload)) {
        setQuery(payload.join(', '));
        setResults([]);
        setLoading(true);
        setError(null);
        setHasSearched(true);
        try {
          const allResults: ExternalPaper[] = [];
          for (const q of payload) {
            if (!q || typeof q !== 'string' || !q.trim()) continue;
            try {
              const res = await searchApi.searchPapers(q.trim(), 1, 0);
              if (res.data && res.data.length > 0) {
                allResults.push(res.data[0]);
              }
            } catch (err) {
              console.warn('Failed to fetch specific paper:', q);
            }
          }
          setResults(allResults);
          setTotal(allResults.length);
          setOffset(0);
        } catch (err: any) {
          setError(err.message || 'Search failed. Please try again.');
        } finally {
          setLoading(false);
        }
      } else if (payload && typeof payload === 'string') {
        setQuery(payload);
        doSearch(payload, 0);
      }
    };
    window.addEventListener('searchDiscover', handleRemoteSearch as any);
    return () => window.removeEventListener('searchDiscover', handleRemoteSearch as any);
  }, [doSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query, 0);
  };

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

  const suggestions = [
    'large language models', 'diffusion models image generation',
    'graph neural networks', 'RLHF reinforcement learning',
    'protein structure prediction', 'federated learning privacy',
  ];

  return (
    <div className="flex-1 bg-[#F9FAFB] overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-md">
              <Globe className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-[#111827]">Discover Papers</h2>
          </div>
          <p className="text-[#6B7280] ml-13">Search millions of real research papers from the internet</p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
            <input
              type="text"
              placeholder="Search: transformers, protein folding, diffusion models..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-[#111827] text-sm shadow-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 px-6 py-4 bg-black text-white font-bold rounded-xl hover:bg-blue-600 transition-all shadow-lg active:scale-95"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5 text-blue-400" />}
            Search
          </button>
        </form>

        {/* Suggestions & Recent Searches */}
        {!hasSearched && (
          <div className="mb-8">
            {recentSearches.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide">Recent searches</p>
                  <button 
                    onClick={() => { setRecentSearches([]); localStorage.removeItem('recentSearches'); }}
                    className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                  >
                    Clear History
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map(s => (
                    <button
                      key={s}
                      onClick={() => { setQuery(s); doSearch(s, 0); }}
                      className="px-4 py-2 bg-gray-50 border border-[#E5E7EB] rounded-full text-sm text-[#374151] hover:border-black hover:text-black transition-all flex items-center gap-2"
                    >
                      <Search className="w-3.5 h-3.5 text-gray-400" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide mb-3">Popular topics</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); doSearch(s, 0); }}
                  className="px-4 py-2 bg-white border border-[#E5E7EB] rounded-full text-sm text-[#374151] hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 px-5 py-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            {error}
          </div>
        )}

        {/* Results */}
        {hasSearched && !loading && results.length === 0 && !error && (
          <div className="text-center py-16 text-[#9CA3AF]">
            <Search className="w-12 h-12 mx-auto mb-4 text-[#D1D5DB]" />
            <p className="text-lg font-medium">No papers found for "{query}"</p>
            <p className="text-sm mt-1">Try different keywords or check spelling</p>
          </div>
        )}

        {results.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[#6B7280]">
                Showing <span className="font-semibold text-[#111827]">{results.length}</span>
                {total > 0 && <> of <span className="font-semibold text-[#111827]">{total.toLocaleString()}</span> results</>}
                {' '}for "<span className="italic">{query}</span>"
              </p>
            </div>

            <div className="space-y-4">
              {results.map(paper => (
                <ExternalPaperCard
                  key={paper.externalId}
                  paper={paper}
                  isImported={importedIds.has(paper.externalId)}
                  isImporting={importingId === paper.externalId}
                  onImport={() => handleImport(paper)}
                />
              ))}
            </div>

            {/* Load More */}
            {results.length < total && (
              <div className="text-center mt-8">
                <button
                  onClick={() => doSearch(query, offset + LIMIT)}
                  disabled={loading}
                  className="px-6 py-3 bg-black text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-all shadow-lg active:scale-95"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                  Load more results
                </button>
              </div>
            )}
          </div>
        )}

        {loading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#6B7280]">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p>Searching Semantic Scholar...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ExternalPaperCard({
  paper, isImported, isImporting, onImport,
}: { paper: ExternalPaper; isImported: boolean; isImporting: boolean; onImport: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">

          <h3 className="text-base font-semibold text-[#111827] leading-snug hover:text-blue-500 transition-colors">
            {paper.title}
          </h3>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-[#6B7280]">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? ` +${paper.authors.length - 3}` : ''}
            </span>
            {paper.year !== 'N/A' && (
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {paper.year}</span>
            )}
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> {paper.citations.toLocaleString()} citations
            </span>
            {paper.doi && (
              <span className="text-[#9CA3AF]">DOI: {paper.doi}</span>
            )}
          </div>

          {/* Abstract */}
          {paper.abstract && (
            <div className="mt-3">
              <p className={`text-sm text-[#4B5563] leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}>
                {paper.abstract}
              </p>
              {paper.abstract.length > 150 && (
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="text-xs text-blue-500 mt-1 hover:underline"
                >
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={onImport}
            disabled={isImported || isImporting}
            title={isImported ? 'Already in library' : 'Import to library'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isImported
                ? 'bg-green-50 text-green-600 border border-green-200 cursor-default'
                : 'bg-black text-white hover:bg-blue-600'
              }`}
          >
            {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isImported ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
            {isImported ? 'Saved' : 'Import'}
          </button>

          {(paper.url || paper.pdfUrl) && (
            <a
              href={paper.url || paper.pdfUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB] transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open
            </a>
          )}

          {paper.pdfUrl && (
            <a
              href={paper.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0] transition-all"
            >
              📄 PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
