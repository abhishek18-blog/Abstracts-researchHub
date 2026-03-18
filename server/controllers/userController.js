import { User, SavedPaper, Project, ReadingProgress } from '../models/index.js';

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const savedCount = await SavedPaper.countDocuments({ user_id: req.userId });
    const projectCount = await Project.countDocuments({ user_id: req.userId });
    const readingCount = await ReadingProgress.countDocuments({ user_id: req.userId, progress: { $gt: 0 } });

    res.json({
      success: true,
      data: {
        ...user.toJSON(),
        stats: {
          savedPapers: savedCount,
          projects: projectCount,
          papersInProgress: readingCount,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user profile' });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { name, email, role, avatar_initials, avatar_url } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (avatar_initials !== undefined) updates.avatar_initials = avatar_initials;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const updated = await User.findByIdAndUpdate(req.userId, updates, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: updated.toJSON() });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: 'Failed to update user profile' });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(req.userId, { avatar_url: avatarUrl }, { new: true });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user.toJSON() });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({ success: false, error: 'Failed to upload avatar' });
  }
};
