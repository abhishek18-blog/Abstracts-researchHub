import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { papersApi } from '../services/api';

interface AbstractViewPaperProps {
  paperId: string;
}

export function AbstractViewPaper({ paperId }: AbstractViewPaperProps) {
  const [fullAbstract, setFullAbstract] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFullAbstract() {
      try {
        setLoading(true);
        // Fetch the specific paper details to get the full abstract
        const response = await papersApi.getById(paperId);
        if (response.data && response.data.abstract) {
          setFullAbstract(response.data.abstract);
        } else {
          setFullAbstract('No abstract available for this paper.');
        }
      } catch (err) {
        console.error('Failed to fetch abstract:', err);
        setFullAbstract('Failed to load the full abstract.');
      } finally {
        setLoading(false);
      }
    }

    if (paperId) {
      fetchFullAbstract();
    }
  }, [paperId]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground text-sm italic border-l-2 border-primary/20 pl-4 py-3 bg-muted/10 rounded-r-xl my-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        Fetching full abstract...
      </div>
    );
  }

  return (
    <div className="text-sm text-foreground leading-relaxed italic border-l-2 border-primary/40 pl-4 py-3 bg-muted/10 rounded-r-xl my-2 shadow-inner">
      "{fullAbstract}"
    </div>
  );
}
