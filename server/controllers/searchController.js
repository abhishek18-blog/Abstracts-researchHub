import { Paper, SavedPaper } from '../models/index.js';
import dotenv from 'dotenv';
dotenv.config();

// [SECURITY - N-C2]: Escape regex metacharacters to prevent ReDoS attacks
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Simple In-Memory Cache ──────────────────────────────────────
const searchCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const MAX_CACHE_SIZE = 1000;

// [SECURITY - MED-02 FIX]: Scope cache keys by userId (or 'public' for guests).
// Guarantees data isolation and prevents potential cross-user cache leakage.
function getCacheKey(q, limit, offset, year, sort, userId = 'public') {
  return `${userId}_${q.trim().toLowerCase()}_${limit}_${offset}_${year || ''}_${sort || ''}`;
}

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
async function searchSemanticScholar(q, limit, offset, useApiKey = true, options = {}) {
  const fields = 'paperId,title,abstract,year,publicationDate,citationCount,authors,externalIds,url,openAccessPdf';
  let apiUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&fields=${fields}`;

  if (options.year) {
    apiUrl += `&year=${encodeURIComponent(options.year)}`;
  }
  if (options.sort) {
    apiUrl += `&sort=${encodeURIComponent(options.sort)}`;
  }

  const headers = { 'Accept': 'application/json' };
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;

  if (useApiKey && apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const response = await fetchWithRetry(apiUrl, { headers }, 1, 1000);

  if (!response || !response.ok) {
    if (response && response.status === 429) {
      console.log(`⚠️ Semantic Scholar (${useApiKey ? 'Official' : 'Public'}) rate limited (429)`);
      return null; // signal to try fallback
    }
    const status = response ? response.status : 'Network error';
    throw new Error(`Semantic Scholar (${useApiKey ? 'Official' : 'Public'}) returned ${status}`);
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
      source: (useApiKey && apiKey) ? 'Semantic Scholar (Official)' : 'Semantic Scholar',
    })),
    total: data.total || 0,
  };
}

// ─── OpenAlex fallback search (completely free, no rate limit) ───
async function searchOpenAlex(q, limit, offset, options = {}) {
  let apiUrl = `https://api.openalex.org/works?filter=title_and_abstract.search:${encodeURIComponent(q)}`;

  // Ignore year and sort restrictions for OpenAlex to avoid future-dated garbage 
  // and ensure we always return highly relevant fallback results.
  apiUrl += `&per_page=${limit}&page=${Math.floor(offset / limit) + 1}&select=id,title,authorships,publication_year,cited_by_count,open_access,doi,primary_location,abstract_inverted_index`;

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

// ============================================================================
// [SECURITY - HIGH-02]: SSRF (Server-Side Request Forgery) Protection Helper
// ============================================================================
// WHAT IS SSRF?
// Server-Side Request Forgery happens when an application fetches a URL supplied
// or influenced by an external user without validating where it points.
// An attacker could supply internal addresses (e.g. `http://localhost:3001` or
// AWS metadata server `http://169.254.169.254/latest/meta-data/`) to read private
// cloud secrets or attack internal infrastructure.
//
// HOW THIS HELPER PROTECTS THE SERVER:
// 1. Ensures the URL uses standard web protocols (`http:` or `https:` only).
// 2. Rejects local loopback hostnames (`localhost`, `127.0.0.1`, `0.0.0.0`, `::1`).
// 3. Blocks private network ranges (`10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`).
// 4. Blocks cloud provider link-local metadata IP (`169.254.169.254`).
// ============================================================================
function isSafeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl);
    
    // Step 1: Reject unsafe schemes like file://, ftp://, gopher://, etc.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Step 2: Block internal, loopback, and cloud metadata hostnames/IPs
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      // Match private IP subnets: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16 (AWS/GCP metadata)
      /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(hostname)
    ) {
      return false;
    }

    return true; // URL passed all security checks!
  } catch {
    return false; // Malformed URL string
  }
}

// ─── Abstract Rescue Helper ──────────────────────────────────────────────
// Aggressively attempts to fetch missing abstract text from external sources (OpenAlex & publisher metadata).
async function rescueAbstract(paper) {
  // If paper already has a valid abstract (at least 20 chars), no rescue needed
  if (paper.abstract && paper.abstract.trim().length >= 20) return paper;

  try {
    // Tier 1: Try OpenAlex inverted index if we have a valid DOI
    if (paper.doi) {
      const oaUrl = `https://api.openalex.org/works/doi:${encodeURIComponent(paper.doi)}`;
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

    // Tier 2: Try HTML scraping from publisher source URL (strictly SSRF-protected via isSafeUrl)
    const targetUrl = paper.url || (paper.doi ? `https://doi.org/${encodeURIComponent(paper.doi)}` : null);
    
    // [SECURITY]: Verify URL is safe BEFORE initiating the outgoing HTTP request
    if (targetUrl && isSafeUrl(targetUrl)) {
      const htmlRes = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0' },
        signal: AbortSignal.timeout(3000) // 3-second timeout guard
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

// GET /api/search/papers?q=query — search real papers (with 3-tier fallback)
export async function searchExternalPapers(req, res) {
  try {
    const { q, limit = 10, offset = 0, year, sort, noOpenAlex } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ success: false, error: 'Search query (q) is required' });
    }

    const userId = req.userId || 'public';
    const cacheKey = getCacheKey(q, limit, offset, year, sort, userId);
    const cached = searchCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log('⚡ Serving search from cache:', cacheKey);
      return res.json(cached.data);
    }

    // Optional cache cleanup if it grows too large
    if (searchCache.size >= MAX_CACHE_SIZE) {
      const firstKey = searchCache.keys().next().value;
      searchCache.delete(firstKey);
    }

    let result = null;
    let source = '';
    const options = { year, sort };

    // Tier 1: Try OpenAlex (No limits, free, instantly scalable)
    if (noOpenAlex !== 'true') {
      try {
        console.log('🔍 [Tier 1] Querying OpenAlex API (No Rate Limits)...');
        result = await searchOpenAlex(q, Number(limit), Number(offset), options);
        if (result) {
          source = 'OpenAlex';
        }
      } catch (err) {
        console.error('⚠️ [Tier 1] OpenAlex failed:', err.message);
      }
    }

    // Tier 2: Try Semantic Scholar Official API (with x-api-key)
    const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
    if (!result && apiKey) {
      try {
        console.log('🔄 [Tier 2] Falling back to Semantic Scholar Official API (with API Key)...');
        result = await searchSemanticScholar(q, Number(limit), Number(offset), true, options);
        if (result) {
          source = 'Semantic Scholar (Official)';
        }
      } catch (err) {
        console.log('⚠️ [Tier 2] Semantic Scholar Official failed:', err.message);
      }
    }

    // Tier 3: Try Semantic Scholar Public API (No API Key)
    if (!result) {
      try {
        console.log('🔄 [Tier 3] Falling back to Semantic Scholar Public (no API key)...');
        result = await searchSemanticScholar(q, Number(limit), Number(offset), false, options);
        if (result) {
          source = 'Semantic Scholar';
        }
      } catch (err) {
        console.log('⚠️ [Tier 3] Semantic Scholar Public failed:', err.message);
      }
    }

    if (!result || !result.papers) {
      return res.status(530).json({
        success: false,
        error: 'External search services are temporarily rate-limited or unavailable. Please try again shortly.',
        data: [],
        total: 0
      });
    }

    if (result && result.papers) {
      // Aggressively attempt to rescue missing abstracts natively via our helper
      result.papers = await Promise.all(
        result.papers.map(p => rescueAbstract(p))
      );
      
      // Filter out papers with bad metadata (future years)
      const currentYear = new Date().getFullYear();
      result.papers = result.papers.filter(p => {
        if (!p.year || p.year === 'N/A') return true;
        const yearInt = parseInt(p.year, 10);
        return !isNaN(yearInt) && yearInt <= currentYear;
      });
    }

    const responseData = {
      success: true,
      data: result.papers || [],
      total: result.total || 0,
      offset: Number(offset),
      limit: Number(limit),
      source,
    };

    searchCache.set(cacheKey, {
      timestamp: Date.now(),
      data: responseData
    });

    res.json(responseData);
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

    // [SECURITY - HIGH-03]: Input Length Validation on External Import
    if (title.length > 500) {
      return res.status(400).json({ success: false, error: 'Paper title must be 500 characters or fewer' });
    }
    if (abstract && abstract.length > 20000) {
      return res.status(400).json({ success: false, error: 'Abstract must be 20,000 characters or fewer' });
    }
    if (url && url.length > 1000) {
      return res.status(400).json({ success: false, error: 'URL must be 1000 characters or fewer' });
    }

    const orConditions = [{ title: new RegExp('^' + escapeRegex(title) + '$', 'i') }];
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
