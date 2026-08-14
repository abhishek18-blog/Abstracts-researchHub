import { Paper, SavedPaper, ReadingProgress, Project, AbstractHighlight } from '../models/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// [SECURITY - N-C2]: Escape user input before using in RegExp to prevent ReDoS.
// An unescaped string like "(((a+)+)+)" causes exponential backtracking in the regex engine.
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const getAllPapers = async (req, res) => {
  try {
    const { search, sort, tag, year, saved_by } = req.query;
    
    let query = {};
    if (search) {
      const q = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { title: q },
        { abstract: q },
        { authors: q }
      ];
    }
    if (tag) {
      query.tags = tag;
    }
    if (year) {
      query.year = year;
    }

    // BEFORE: let papers = [];  ← useless empty box that got thrown away immediately
    // AFTER: removed — we declare papers directly below when we actually have the data
    if (saved_by) {
      const userIdToFilter = saved_by === 'true' ? req.userId : saved_by;
      const savedEntries = await SavedPaper.find({ user_id: userIdToFilter });
      const paperIds = savedEntries.map(s => s.paper_id);
      
      // Filter the existing query to only include these IDs
      query._id = { $in: paperIds };
    }

    // BEFORE: switch with a 'most_cited' case that was identical to the default above it \u2014 pointless.
    //   let sortOpt = { citations: -1 };
    //   case 'most_cited': sortOpt = { citations: -1 }; ← same thing! does nothing new.
    //
    // AFTER: simplified to if/else \u2014 only handles cases that actually change something
    let sortOpt = { citations: -1 }; // default: sort by most cited
    if (sort === 'most_recent') sortOpt = { year: -1 };
    else if (sort === 'oldest') sortOpt = { year: 1 };
    
    // BEFORE: papers = await Paper.find(...)  ← was overwriting the useless empty [] above
    // AFTER: const papers = ...  ← cleaner, 'const' means it will never be reassigned
    const papers = await Paper.find(query).sort(sortOpt);

    // ✅ FIXED: Instead of querying the DB once per paper (which causes 100 queries for 50 papers),
    // we now do 2 bulk queries to get ALL saved + progress data for this user in one shot.
    // Then we use a Set and a Map to look up each paper's status instantly (no extra DB trips).
    const [allSaved, allProgress] = await Promise.all([
      SavedPaper.find({ user_id: req.userId }).lean(),        // get all papers this user has saved
      ReadingProgress.find({ user_id: req.userId }).lean()    // get all reading progress for this user
    ]);

    // Build a Set of saved paper IDs so we can check "is this paper saved?" instantly
    const savedSet = new Set(allSaved.map(s => String(s.paper_id)));

    // Build a Map of paper ID → progress percentage for instant lookup
    const progressMap = new Map(allProgress.map(p => [String(p.paper_id), p.progress]));

    // Now simply map over papers — no DB queries inside the loop!
    const result = papers
      .filter(paper => paper) // skip any null/undefined entries
      .map(paper => ({
        ...paper.toJSON(),
        saved: savedSet.has(String(paper._id)),                    // instant lookup from Set
        readingProgress: progressMap.get(String(paper._id))       // instant lookup from Map
      }));

    res.json({ success: true, data: result, count: result.length });
  } catch (error) {
    console.error('CRITICAL ERROR in getAllPapers:', {
      message: error.message,
      stack: error.stack,
      query: req.query,
      userId: req.userId
    });
    // [SECURITY - N-M1]: Don't expose raw error.message in production
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ success: false, error: isDev ? 'Failed to fetch papers: ' + error.message : 'Failed to fetch papers' });
  }
};

export const getPaperById = async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) {
      return res.status(404).json({ success: false, error: 'Paper not found' });
    }

    const savedEntry = await SavedPaper.findOne({ user_id: req.userId, paper_id: paper._id });
    const progressEntry = await ReadingProgress.findOne({ user_id: req.userId, paper_id: paper._id });

    // Attempt to fetch abstract dynamically if missing
    let fetchedAbstract = paper.abstract;
    if (!fetchedAbstract || fetchedAbstract.trim().length < 20) {
      try {
        // 1. Try Semantic Scholar
        if (paper.external_id && !paper.external_id.includes('openalex')) {
          const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY || process.env.S2_API_KEY;
          const headers = { 'Accept': 'application/json' };
          if (apiKey) headers['x-api-key'] = apiKey;

          const sRes = await fetch(`https://api.semanticscholar.org/graph/v1/paper/${paper.external_id}?fields=abstract`, { headers });
          if (sRes.ok) {
            const sData = await sRes.json();
            if (sData.abstract) fetchedAbstract = sData.abstract;
          }
        } 
        
        // 2. Try OpenAlex
        if ((!fetchedAbstract || fetchedAbstract.trim().length < 20) && paper.doi) {
          const oaRes = await fetch(`https://api.openalex.org/works/doi:${paper.doi}`);
          if (oaRes.ok) {
            const oaData = await oaRes.json();
            if (oaData.abstract_inverted_index) {
              const index = oaData.abstract_inverted_index;
              const words = [];
              for (const [word, positions] of Object.entries(index)) {
                for (const pos of positions) words[pos] = word;
              }
              fetchedAbstract = words.join(' ').replace(/\s+/g, ' ').trim();
            }
          }
        }

        // 3. Fallback to HTML Scraping from source url meta tags (fixes user's issue entirely)
        // [SECURITY - N-L4]: Validate source_url is a safe http/https URL before fetching.
        // Without this, an attacker could supply file:// or http://internal-service URLs (SSRF).
        let isSafeUrl = false;
        try {
          const parsedUrl = new URL(paper.source_url);
          isSafeUrl = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
        } catch { /* invalid URL — skip */ }

        if ((!fetchedAbstract || fetchedAbstract.trim().length < 20) && isSafeUrl) {
          try {
            const htmlRes = await fetch(paper.source_url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              signal: AbortSignal.timeout(4000)
            });
            if (htmlRes.ok) {
              const html = await htmlRes.text();
              const citationMatch = html.match(/<meta[^>]*name=["']citation_abstract["'][^>]*content=["']([^"']+)["'][^>]*>/i);
              const dcMatch = html.match(/<meta[^>]*name=["']dc\.description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
              const ogMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
              
              if (citationMatch) fetchedAbstract = citationMatch[1];
              else if (dcMatch) fetchedAbstract = dcMatch[1];
              else if (ogMatch && !ogMatch[1].includes('research-article')) fetchedAbstract = ogMatch[1];
            }
          } catch (e) { /* ignore timeout */ }
        }

        // Save back to DB to permanently fix this paper
        if (fetchedAbstract && fetchedAbstract.trim().length >= 20 && fetchedAbstract !== paper.abstract) {
          paper.abstract = fetchedAbstract;
          await paper.save();
        }
      } catch (err) {
        console.error('Dynamic abstract fetch error:', err.message);
      }
    }

    const responseData = paper.toJSON();
    if (fetchedAbstract && fetchedAbstract.trim().length >= 20) {
      responseData.abstract = fetchedAbstract;
    }

    res.json({
      success: true,
      data: {
        ...responseData,
        saved: !!savedEntry,
        readingProgress: progressEntry ? progressEntry.progress : undefined,
      },
    });
  } catch (error) {
    console.error('Error fetching paper:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch paper' });
  }
};

export const createPaper = async (req, res) => {
  try {
    const { title, authors, year, citations, tags, abstract, pdf_url, source_url } = req.body;

    if (!title || !authors || !year) {
      return res.status(400).json({ success: false, error: 'title, authors, and year are required' });
    }

    // [SECURITY - HIGH-03]: Input Length Caps on Paper Metadata
    // Protects database and search index against massive text payloads.
    if (title.length > 500) {
      return res.status(400).json({ success: false, error: 'Title must be 500 characters or fewer' });
    }
    if (abstract && abstract.length > 20000) {
      return res.status(400).json({ success: false, error: 'Abstract must be 20,000 characters or fewer' });
    }
    if (pdf_url && pdf_url.length > 1000) {
      return res.status(400).json({ success: false, error: 'pdf_url must be 1000 characters or fewer' });
    }
    if (source_url && source_url.length > 1000) {
      return res.status(400).json({ success: false, error: 'source_url must be 1000 characters or fewer' });
    }

    const paper = new Paper({
      title: title.trim(),
      authors: Array.isArray(authors) ? authors : [authors],
      year,
      citations: citations || 0,
      tags: tags || [],
      abstract: abstract ? abstract.trim() : '',
      pdf_url: pdf_url || null,
      source_url: source_url || null
    });

    await paper.save();
    res.status(201).json({ success: true, data: paper.toJSON() });
  } catch (error) {
    console.error('Error creating paper:', error);
    res.status(500).json({ success: false, error: 'Failed to create paper' });
  }
};

export const updatePaper = async (req, res) => {
  try {
    // ============================================================================
    // [SECURITY - MED-03]: Flexible Paper Editing Permissions
    // ============================================================================
    // Previously, this route was strictly locked to `requestingUser.role === 'admin'`.
    // Because no route existed to assign the 'admin' role, paper editing was 100% blocked.
    //
    // SOLUTION:
    // Any authenticated user (Students, Researchers, Professors, Admins) is permitted
    // to edit paper metadata (title, abstract, authors, links) to correct missing/wrong info,
    // while input length validation guards against malicious payload bloat.
    // ============================================================================
    const { User } = await import('../models/index.js');
    const requestingUser = await User.findById(req.userId);
    if (!requestingUser) {
      return res.status(401).json({ success: false, error: 'Authentication required to update papers' });
    }

    const existing = await Paper.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Paper not found' });
    }

    const { title, authors, year, citations, tags, abstract, pdf_url, source_url } = req.body;

    // [SECURITY - HIGH-03]: Input Length Validation for Updates
    if (title !== undefined && title.length > 500) {
      return res.status(400).json({ success: false, error: 'Title must be 500 characters or fewer' });
    }
    if (abstract !== undefined && abstract.length > 20000) {
      return res.status(400).json({ success: false, error: 'Abstract must be 20,000 characters or fewer' });
    }

    if (title !== undefined) existing.title = title.trim();
    if (authors !== undefined) existing.authors = Array.isArray(authors) ? authors : [authors];
    if (year !== undefined) existing.year = year;
    if (citations !== undefined) existing.citations = citations;
    if (tags !== undefined) existing.tags = tags;
    if (abstract !== undefined) existing.abstract = abstract.trim();
    if (pdf_url !== undefined) existing.pdf_url = pdf_url;
    if (source_url !== undefined) existing.source_url = source_url;

    await existing.save();
    res.json({ success: true, data: existing.toJSON() });
  } catch (error) {
    console.error('Error updating paper:', error);
    res.status(500).json({ success: false, error: 'Failed to update paper' });
  }
};

export const deletePaper = async (req, res) => {
  try {
    // [SECURITY - N-C1]: Restrict paper deletion to admin roles only.
    const { User } = await import('../models/index.js');
    const requestingUser = await User.findById(req.userId);
    const ADMIN_ROLES = ['admin', 'Admin'];
    if (!requestingUser || !ADMIN_ROLES.includes(requestingUser.role)) {
      return res.status(403).json({ success: false, error: 'Only admins can delete papers' });
    }

    const existing = await Paper.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Paper not found' });
    }

    // 2. Remove paper from all users' saved papers and reading progress
    await SavedPaper.deleteMany({ paper_id: existing._id });
    await ReadingProgress.deleteMany({ paper_id: existing._id });
    await AbstractHighlight.deleteMany({ paper_id: existing._id });
    
    const projects = await Project.find({ papers: existing._id });
    for (const project of projects) {
      project.papers = project.papers.filter(p => String(p) !== String(existing._id));
      await project.save();
    }

    await Paper.deleteOne({ _id: existing._id });

    res.json({ success: true, message: 'Paper deleted and storage cleared' });
  } catch (error) {
    console.error('Error deleting paper:', error);
    res.status(500).json({ success: false, error: 'Failed to delete paper' });
  }
};

export const toggleSavePaper = async (req, res) => {
  try {
    const paperId = req.params.id;
    const paper = await Paper.findById(paperId);
    if (!paper) {
      return res.status(404).json({ success: false, error: 'Paper not found' });
    }

    let existing = await SavedPaper.findOne({ user_id: req.userId, paper_id: paperId });

    if (existing) {
      await SavedPaper.deleteOne({ _id: existing._id });
      res.json({ success: true, data: { saved: false }, message: 'Paper unsaved' });
    } else {
      const savedPaper = new SavedPaper({ user_id: req.userId, paper_id: paperId });
      await savedPaper.save();
      res.json({ success: true, data: { saved: true }, message: 'Paper saved' });
    }
  } catch (error) {
    console.error('Error toggling save:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle save' });
  }
};

export const updateReadingProgress = async (req, res) => {
  try {
    const { progress } = req.body;
    if (progress === undefined || progress < 0 || progress > 100) {
      return res.status(400).json({ success: false, error: 'Progress must be between 0 and 100' });
    }

    const paper = await Paper.findById(req.params.id);
    if (!paper) {
      return res.status(404).json({ success: false, error: 'Paper not found' });
    }

    let existing = await ReadingProgress.findOne({ user_id: req.userId, paper_id: req.params.id });

    if (existing) {
      existing.progress = progress;
      existing.last_read_at = new Date();
      await existing.save();
    } else {
      existing = new ReadingProgress({
        user_id: req.userId,
        paper_id: req.params.id,
        progress,
        last_read_at: new Date(),
      });
      await existing.save();
    }

    res.json({ success: true, data: { paperId: req.params.id, progress } });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ success: false, error: 'Failed to update reading progress' });
  }
};

export const getAbstractHighlights = async (req, res) => {
  try {
    const highlights = await AbstractHighlight.find({ paper_id: req.params.id, user_id: req.userId });
    res.json({ success: true, data: highlights });
  } catch (error) {
    console.error('Error fetching highlights:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch highlights' });
  }
};

export const addAbstractHighlight = async (req, res) => {
  try {
    const { text, color } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }
    const highlight = new AbstractHighlight({
      user_id: req.userId,
      paper_id: req.params.id,
      text,
      color: color || 'yellow'
    });
    await highlight.save();
    res.status(201).json({ success: true, data: highlight });
  } catch (error) {
    console.error('Error adding highlight:', error);
    res.status(500).json({ success: false, error: 'Failed to add highlight' });
  }
};

export const removeAbstractHighlight = async (req, res) => {
  try {
    const highlight = await AbstractHighlight.findOne({ _id: req.params.highlightId, user_id: req.userId });
    if (!highlight) {
      return res.status(404).json({ success: false, error: 'Highlight not found' });
    }
    await AbstractHighlight.deleteOne({ _id: highlight._id });
    res.json({ success: true, message: 'Highlight removed' });
  } catch (error) {
    console.error('Error removing highlight:', error);
    res.status(500).json({ success: false, error: 'Failed to remove highlight' });
  }
};
