import { Paper, SavedPaper } from '../models/index.js';

// ─── Helper: fetch with retry for rate-limited APIs ──────────────
async function fetchWithRetry(url, options = {}, retries = 2, delayMs = 2000) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, options);
    if (res.status === 429 && i < retries) {
      console.log(`⏳ Rate limited, retrying in ${delayMs}ms... (attempt ${i + 2})`);
      await new Promise(r => setTimeout(r, delayMs));
      delayMs *= 2; // exponential backoff
      continue;
    }
    return res;
  }
}

// ─── Semantic Scholar search ─────────────────────────────────────
async function searchSemanticScholar(q, limit, offset) {
  const fields = 'paperId,title,abstract,year,citationCount,authors,externalIds,url,openAccessPdf';
  const apiUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&fields=${fields}`;

  const response = await fetchWithRetry(apiUrl, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    if (response.status === 429) {
      return null; // signal to try fallback
    }
    throw new Error(`Semantic Scholar returned ${response.status}`);
  }

  const data = await response.json();
  return {
    papers: (data.data || []).map((paper) => ({
      externalId: paper.paperId,
      title: paper.title || 'Untitled',
      authors: (paper.authors || []).map((a) => a.name),
      year: paper.year ? String(paper.year) : 'N/A',
      citations: paper.citationCount || 0,
      abstract: paper.abstract || '',
      url: paper.url || null,
      pdfUrl: paper.openAccessPdf?.url || null,
      doi: paper.externalIds?.DOI || null,
      source: 'Semantic Scholar',
    })),
    total: data.total || 0,
  };
}

// ─── OpenAlex fallback search (completely free, no rate limit) ───
async function searchOpenAlex(q, limit, offset) {
  const apiUrl = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per_page=${limit}&page=${Math.floor(offset / limit) + 1}&select=id,title,authorships,publication_year,cited_by_count,open_access,doi,primary_location,abstract_inverted_index`;

  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Abstracts/1.0 (mailto:abstracts@example.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`OpenAlex returned ${response.status}`);
  }

  const data = await response.json();
  return {
    papers: (data.results || []).map((work) => {
      const pdfUrl = work.open_access?.oa_url || work.primary_location?.pdf_url || null;
      const sourceUrl = work.primary_location?.landing_page_url || work.doi || null;

      let abstract = '';
      if (work.abstract_inverted_index) {
        const index = work.abstract_inverted_index;
        const words = [];
        for (const [word, positions] of Object.entries(index)) {
          for (const pos of positions) {
            words[pos] = word;
          }
        }
        abstract = words.join(' ').replace(/\s+/g, ' ').trim();
      }

      return {
        externalId: work.id?.replace('https://openalex.org/', '') || '',
        title: work.title || 'Untitled',
        authors: (work.authorships || []).slice(0, 8).map((a) => a.author?.display_name || 'Unknown'),
        year: work.publication_year ? String(work.publication_year) : 'N/A',
        citations: work.cited_by_count || 0,
        abstract,
        url: sourceUrl,
        pdfUrl,
        doi: work.doi?.replace('https://doi.org/', '') || null,
        source: 'OpenAlex',
      };
    }),
    total: data.meta?.count || 0,
  };
}

// ─── Abstract Rescue Helper ──────────────────────────────────────────────
async function rescueAbstract(paper) {
  if (paper.abstract && paper.abstract.trim().length >= 20) return paper;

  try {
    // 1. Try OpenAlex if we have a DOI and missing abstract
    if (paper.doi) {
      const oaUrl = `https://api.openalex.org/works/doi:${paper.doi}`;
      const oaRes = await fetch(oaUrl);
      if (oaRes.ok) {
        const oaData = await oaRes.json();
        if (oaData.abstract_inverted_index) {
          const index = oaData.abstract_inverted_index;
          const words = [];
          for (const [word, positions] of Object.entries(index)) {
            for (const pos of positions) words[pos] = word;
          }
          paper.abstract = words.join(' ').replace(/\s+/g, ' ').trim();
          if (paper.abstract.length >= 20) return paper;
        }
      }
    }

    // 2. Try HTML scraping directly from the publisher source url
    const targetUrl = paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : null);
    if (targetUrl) {
      const htmlRes = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0' },
        signal: AbortSignal.timeout(3000)
      });
      if (htmlRes.ok) {
        const html = await htmlRes.text();
        const citationMatch = html.match(/<meta[^>]*name=["']citation_abstract["'][^>]*content=["']([^"']+)["'][^>]*>/i);
        const dcMatch = html.match(/<meta[^>]*name=["']dc\.description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
        const ogMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i);

        if (citationMatch) paper.abstract = citationMatch[1];
        else if (dcMatch) paper.abstract = dcMatch[1];
        else if (ogMatch && !ogMatch[1].includes('research-article')) paper.abstract = ogMatch[1];
      }
    }
  } catch (e) {
    // silently fail and return original paper missing the abstract
  }
  return paper;
}

// GET /api/search/papers?q=query — search real papers (with fallback)
export async function searchExternalPapers(req, res) {
  try {
    const { q, limit = 10, offset = 0 } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ success: false, error: 'Search query (q) is required' });
    }

    let result = null;
    let source = '';

    // Try Semantic Scholar first
    try {
      result = await searchSemanticScholar(q, Number(limit), Number(offset));
      source = 'Semantic Scholar';
    } catch (err) {
      console.log('⚠️ Semantic Scholar failed:', err.message);
    }

    // Fallback to OpenAlex if Semantic Scholar failed or rate-limited
    if (!result) {
      try {
        console.log('🔄 Falling back to OpenAlex...');
        result = await searchOpenAlex(q, Number(limit), Number(offset));
        source = 'OpenAlex';
      } catch (err) {
        console.error('❌ OpenAlex also failed:', err.message);
        return res.status(503).json({
          success: false,
          error: 'Both paper search services are unavailable. Please try again in a moment.',
        });
      }
    }

    if (result && result.papers) {
      // Aggressively attempt to rescue missing abstracts natively via our helper
      result.papers = await Promise.all(
        result.papers.map(p => rescueAbstract(p))
      );
    }

    res.json({
      success: true,
      data: result.papers,
      total: result.total,
      offset: Number(offset),
      limit: Number(limit),
      source,
    });
  } catch (error) {
    console.error('Error searching external papers:', error);
    res.status(500).json({ success: false, error: 'Failed to search papers. Please try again.' });
  }
}

// POST /api/search/papers/import — import an external paper into the local library
export async function importExternalPaper(req, res) {
  try {
    const { title, authors, year, citations, abstract, url, pdfUrl, doi, externalId } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Paper title is required' });
    }

    const orConditions = [{ title: new RegExp('^' + title + '$', 'i') }];
    if (doi) orConditions.push({ doi });
    if (externalId) orConditions.push({ external_id: externalId });

    // Check if already imported
    const existing = await Paper.findOne({ $or: orConditions });

    if (existing) {
      return res.status(409).json({ success: false, error: 'Paper already in your library', data: existing.toJSON() });
    }

    const tags = [];
    if (pdfUrl) tags.push('PDF Available');
    if (citations > 1000) tags.push('Highly Cited');

    const paper = new Paper({
      title,
      authors: Array.isArray(authors) ? authors : [authors || 'Unknown'],
      year: year || 'N/A',
      citations: citations || 0,
      tags,
      abstract: abstract || '',
      pdf_url: pdfUrl || null,
      source_url: url || null,
      doi: doi || null,
      external_id: externalId || null,
    });

    const savedPaper = await paper.save();

    // Also mark as saved for the current user who imported it
    const userSave = new SavedPaper({
      user_id: req.userId,
      paper_id: paper._id
    });
    await userSave.save();

    res.status(201).json({ success: true, data: paper.toJSON() });
  } catch (error) {
    console.error('Error importing paper:', error);
    res.status(500).json({ success: false, error: 'Failed to import paper' });
  }
}
