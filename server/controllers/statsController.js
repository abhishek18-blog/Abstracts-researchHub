import { Paper, SavedPaper, Project, ReadingProgress, Conversation, Upload } from '../models/index.js';

export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.userId;

    const totalPapers = await Paper.countDocuments();
    const savedPapers = await SavedPaper.countDocuments({ user_id: userId });
    const totalProjects = await Project.countDocuments({ user_id: userId });

    const readingProgress = await ReadingProgress.find({ user_id: userId });
    const inProgress = readingProgress.filter((r) => r.progress > 0 && r.progress < 100).length;
    const completed = readingProgress.filter((r) => r.progress === 100).length;
    const avgProgress =
      readingProgress.length > 0
        ? Math.round(readingProgress.reduce((sum, r) => sum + r.progress, 0) / readingProgress.length)
        : 0;

    const totalConversations = await Conversation.countDocuments({ user_id: userId });
    const totalUploads = await Upload.countDocuments({ user_id: userId });

    const recentReadings = await ReadingProgress.find({ user_id: userId })
      .sort({ last_read_at: -1 })
      .limit(5)
      .populate('paper_id');

    const recentActivity = recentReadings
      .filter(rp => rp.paper_id)
      .map(rp => ({
        paperId: rp.paper_id._id,
        title: rp.paper_id.title,
        progress: rp.progress,
        lastReadAt: rp.last_read_at
      }));

    const allPapers = await Paper.find();
    const tagCounts = {};
    const yearCounts = {};
    for (const paper of allPapers) {
      if (paper.tags) {
        for (const tag of paper.tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }
      if (paper.year) {
        yearCounts[paper.year] = (yearCounts[paper.year] || 0) + 1;
      }
    }

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));

    const papersByYear = Object.entries(yearCounts)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([year, count]) => ({ year, count }));

    res.json({
      success: true,
      data: {
        overview: {
          totalPapers,
          savedPapers,
          totalProjects,
          inProgress,
          completed,
          avgProgress,
          totalConversations,
          totalUploads,
        },
        recentActivity,
        topTags,
        papersByYear,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
  }
};
