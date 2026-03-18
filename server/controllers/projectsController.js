import { Project, Paper, ReadingProgress, SavedPaper } from '../models/index.js';

export const getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find({ user_id: req.userId });

    const result = [];
    for (const project of projects) {
      const paperCount = project.papers ? project.papers.length : 0;
      let totalProgress = 0;
      let progressCount = 0;

      if (project.papers && project.papers.length > 0) {
        for (const pId of project.papers) {
          const rp = await ReadingProgress.findOne({ user_id: req.userId, paper_id: pId });
          if (rp) {
            totalProgress += rp.progress;
            progressCount++;
          }
        }
      }

      const avgProgress = progressCount > 0 ? Math.round(totalProgress / progressCount) : 0;

      result.push({
        ...project.toJSON(),
        paperCount,
        progress: avgProgress,
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch projects' });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, user_id: req.userId }).populate('papers');
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const papers = [];
    for (const paper of project.papers) {
      if (!paper) continue;
      
      const savedEntry = await SavedPaper.findOne({ user_id: req.userId, paper_id: paper._id });
      const progressEntry = await ReadingProgress.findOne({ user_id: req.userId, paper_id: paper._id });

      papers.push({
        ...paper.toJSON(),
        saved: !!savedEntry,
        readingProgress: progressEntry ? progressEntry.progress : undefined,
      });
    }

    const progressValues = papers
      .map((p) => p.readingProgress || 0)
      .filter((v) => v !== undefined);
    
    const progress = progressValues.length > 0
      ? Math.round(progressValues.reduce((a, b) => a + b, 0) / progressValues.length)
      : 0;

    res.json({
      success: true,
      data: {
        ...project.toJSON(),
        paperCount: papers.length,
        progress,
        papers,
      },
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch project' });
  }
};

export const createProject = async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Project name is required' });
    }

    const project = new Project({
      user_id: req.userId,
      name,
      description: description || '',
      color: color || 'bg-blue-500',
      papers: []
    });

    await project.save();
    res.status(201).json({ success: true, data: { ...project.toJSON(), paperCount: 0, progress: 0 } });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
};

export const updateProject = async (req, res) => {
  try {
    const existing = await Project.findOne({ _id: req.params.id, user_id: req.userId });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const { name, description, color } = req.body;
    if (name !== undefined) existing.name = name;
    if (description !== undefined) existing.description = description;
    if (color !== undefined) existing.color = color;

    await existing.save();
    res.json({ success: true, data: existing.toJSON() });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const existing = await Project.findOne({ _id: req.params.id, user_id: req.userId });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    await Project.deleteOne({ _id: existing._id });

    res.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
};

export const addPaperToProject = async (req, res) => {
  try {
    const { paperId } = req.body;
    if (!paperId) {
      return res.status(400).json({ success: false, error: 'paperId is required' });
    }

    const project = await Project.findOne({ _id: req.params.id, user_id: req.userId });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const paper = await Paper.findById(paperId);
    if (!paper) {
      return res.status(404).json({ success: false, error: 'Paper not found' });
    }

    if (project.papers && project.papers.includes(paperId)) {
      return res.status(409).json({ success: false, error: 'Paper already in project' });
    }

    project.papers = project.papers || [];
    project.papers.push(paperId);
    await project.save();

    res.status(201).json({ success: true, message: 'Paper added to project' });
  } catch (error) {
    console.error('Error adding paper to project:', error);
    res.status(500).json({ success: false, error: 'Failed to add paper to project' });
  }
};

export const removePaperFromProject = async (req, res) => {
  try {
    const { id, paperId } = req.params;
    const project = await Project.findOne({ _id: id, user_id: req.userId });
    
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (!project.papers || !project.papers.includes(paperId)) {
      return res.status(404).json({ success: false, error: 'Paper not found in project' });
    }

    project.papers = project.papers.filter(p => p !== paperId);
    await project.save();

    res.json({ success: true, message: 'Paper removed from project' });
  } catch (error) {
    console.error('Error removing paper from project:', error);
    res.status(500).json({ success: false, error: 'Failed to remove paper from project' });
  }
};
