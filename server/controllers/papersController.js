import { Paper, SavedPaper, ReadingProgress, Project, Upload } from '../models/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getAllPapers = async (req, res) => {
  try {
    const { search, sort, tag, year, saved_by } = req.query;
    
    let query = {};
    if (search) {
      const q = new RegExp(search, 'i');
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

    let papers = [];
    if (saved_by) {
      const userIdToFilter = saved_by === 'true' ? req.userId : saved_by;
      const savedEntries = await SavedPaper.find({ user_id: userIdToFilter });
      const paperIds = savedEntries.map(s => s.paper_id);
      
      // Filter the existing query to only include these IDs
      query._id = { $in: paperIds };
    }

    let sortOpt = { citations: -1 };
    switch (sort) {
      case 'most_cited': sortOpt = { citations: -1 }; break;
      case 'most_recent': sortOpt = { year: -1 }; break;
      case 'oldest': sortOpt = { year: 1 }; break;
    }
    
    papers = await Paper.find(query).sort(sortOpt);

    const result = [];
    for (const paper of papers) {
      if (!paper) continue;
      const savedEntry = await SavedPaper.findOne({ user_id: req.userId, paper_id: paper._id });
      const progressEntry = await ReadingProgress.findOne({ user_id: req.userId, paper_id: paper._id });

      result.push({
        ...paper.toJSON(),
        saved: !!savedEntry,
        readingProgress: progressEntry ? progressEntry.progress : undefined,
      });
    }

    res.json({ success: true, data: result, count: result.length });
  } catch (error) {
    console.error('CRITICAL ERROR in getAllPapers:', {
      message: error.message,
      stack: error.stack,
      query: req.query,
      userId: req.userId
    });
    res.status(500).json({ success: false, error: 'Failed to fetch papers: ' + error.message });
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

    res.json({
      success: true,
      data: {
        ...paper.toJSON(),
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

    const paper = new Paper({
      title,
      authors: Array.isArray(authors) ? authors : [authors],
      year,
      citations: citations || 0,
      tags: tags || [],
      abstract: abstract || '',
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
    const existing = await Paper.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Paper not found' });
    }

    const { title, authors, year, citations, tags, abstract, pdf_url, source_url } = req.body;
    if (title !== undefined) existing.title = title;
    if (authors !== undefined) existing.authors = Array.isArray(authors) ? authors : [authors];
    if (year !== undefined) existing.year = year;
    if (citations !== undefined) existing.citations = citations;
    if (tags !== undefined) existing.tags = tags;
    if (abstract !== undefined) existing.abstract = abstract;
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
    const existing = await Paper.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Paper not found' });
    }

    // Find and delete associated uploads/files
    const uploads = await Upload.find({ paper_id: existing._id });
    for (const upload of uploads) {
      const filePath = path.join(__dirname, '..', 'uploads', upload.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await Upload.deleteOne({ _id: upload._id });
    }

    await Paper.deleteOne({ _id: existing._id });
    await SavedPaper.deleteMany({ paper_id: existing._id });
    await ReadingProgress.deleteMany({ paper_id: existing._id });

    // Remove from projects
    const projects = await Project.find({ papers: existing._id });
    for (const project of projects) {
      project.papers = project.papers.filter(p => String(p) !== String(existing._id));
      await project.save();
    }

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
