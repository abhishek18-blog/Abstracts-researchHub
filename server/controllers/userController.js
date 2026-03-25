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
    
    // Add interests array handling
    if (req.body.interests !== undefined) updates.interests = req.body.interests;
    if (req.body.hasSelectedInterests !== undefined) updates.hasSelectedInterests = req.body.hasSelectedInterests;

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

    const base64Image = req.file.buffer.toString('base64');
    const avatarUrl = `data:${req.file.mimetype};base64,${base64Image}`;
    const user = await User.findByIdAndUpdate(req.userId, { avatar_url: avatarUrl }, { new: true });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user.toJSON() });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({ success: false, error: `Upload failed: ${error.message}` });
  }
};

import bcrypt from 'bcryptjs';

export const addPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Invalid password' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.findByIdAndUpdate(req.userId, { password: hashedPassword }, { new: true });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, message: 'Password added successfully' });
  } catch (error) {
    console.error('Error adding password:', error);
    res.status(500).json({ success: false, error: 'Failed to add password' });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Clean up associated data
    await SavedPaper.deleteMany({ user_id: req.userId });
    await Project.deleteMany({ user_id: req.userId });
    await ReadingProgress.deleteMany({ user_id: req.userId });

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ success: false, error: 'Failed to delete account' });
  }
};
