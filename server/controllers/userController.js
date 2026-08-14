// ============================================================
// controllers/userController.js — User Profile Management
// ============================================================

// [SECURITY - N-L1]: All imports must be at the top of the file.
// Previously bcrypt was imported at line ~137, mid-file, which is confusing
// and can hide dependencies. ES modules hoist imports but it's still bad practice.
import bcrypt from 'bcryptjs';
import { User, SavedPaper, Project, ReadingProgress } from '../models/index.js';

// ─────────────────────────────────────────────
// 👤 GET USER PROFILE — Fetch profile + stats
// ─────────────────────────────────────────────
// GET /api/user
// Returns the user's basic info AND a summary of their activity:
// how many papers they saved, how many projects they have, etc.
export const getUserProfile = async (req, res) => {
  try {
    // req.userId is injected by authMiddleware after verifying the JWT token
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Count how many papers this user has saved to their library
    const savedCount = await SavedPaper.countDocuments({ user_id: req.userId });

    // Count how many research projects this user has created
    const projectCount = await Project.countDocuments({ user_id: req.userId });

    // Count papers where reading progress is more than 0% (i.e. they actually started reading)
    const readingCount = await ReadingProgress.countDocuments({ user_id: req.userId, progress: { $gt: 0 } });
    // $gt: 0 means "greater than 0" — MongoDB query operator

    // Return the user object with the stats bundled in
    res.json({
      success: true,
      data: {
        ...user.toJSON(), // spread the user fields (name, email, role, etc.)
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


// ─────────────────────────────────────────────
// ✏️ UPDATE USER PROFILE — Edit account info
// ─────────────────────────────────────────────
// PUT /api/user
// Body can contain any of: { name, email, role, avatar_initials, avatar_url, interests, hasSelectedInterests }
// Only the fields that are sent in the body will be updated (partial update).
export const updateUserProfile = async (req, res) => {
  try {
    // Destructure only the expected fields from the request body
    const { name, email, role, avatar_initials, avatar_url } = req.body;

    // Build an "updates" object dynamically — only include fields that were actually sent.
    // This prevents accidentally overwriting fields with undefined.
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    
    // [SECURITY - N-C3]: Privilege Escalation Prevention.
    // Prevent normal users from upgrading themselves to 'admin'.
    if (role !== undefined) {
      if (!['Student', 'Researcher'].includes(role)) {
        return res.status(403).json({ success: false, error: 'Invalid role specified' });
      }
      updates.role = role;
    }
    
    if (avatar_initials !== undefined) updates.avatar_initials = avatar_initials;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    
    // Also handle interest-related fields (used during the onboarding/topic selection step)
    if (req.body.interests !== undefined) updates.interests = req.body.interests;
    if (req.body.hasSelectedInterests !== undefined) updates.hasSelectedInterests = req.body.hasSelectedInterests;

    // Find the user by ID and apply only the updated fields.
    // { new: true } returns the updated document instead of the old one.
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


// ─────────────────────────────────────────────
// 🖼️ UPLOAD AVATAR — Set a profile picture
// ─────────────────────────────────────────────
// POST /api/user/avatar  (multipart/form-data with field name "avatar")
// The file is handled by multer middleware (set up in routes/user.js) before this runs.
// req.file contains the uploaded file's buffer (raw binary data).
export const uploadAvatar = async (req, res) => {
  try {
    // If no file was included in the request, reject it
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // [SECURITY - H4]: Server-side MIME type validation.
    // Multer config can be bypassed by spoofing Content-Type headers.
    // We validate the actual mimetype here as a second layer of defense.
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, error: 'Only JPEG, PNG, WebP, and GIF images are allowed' });
    }

    // Convert the image binary (buffer) into a Base64-encoded string.
    // Base64 lets us store and send images as plain text inside JSON.
    // The resulting string looks like: "data:image/png;base64,iVBORw0KGgo..."
    const base64Image = req.file.buffer.toString('base64');
    const avatarUrl = `data:${req.file.mimetype};base64,${base64Image}`;

    // Save the base64 image string directly to the user document in MongoDB
    const user = await User.findByIdAndUpdate(req.userId, { avatar_url: avatarUrl }, { new: true });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user.toJSON() });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    // [SECURITY - N-M1]: Don't expose raw error message in production
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ success: false, error: isDev ? `Upload failed: ${error.message}` : 'Upload failed' });
  }
};


// bcrypt is already imported at the top of this file.


// ─────────────────────────────────────────────
// 🔐 ADD PASSWORD — Let Google users set a password
// ─────────────────────────────────────────────
// POST /api/user/password
// Body: { password }
// When a user signs up via Google, they have no password in our DB.
// This endpoint lets them add one so they can also log in with email/password.
export const addPassword = async (req, res) => {
  try {
    const { password } = req.body;

    // [SECURITY - LOW-04]: Standardized Password Minimum Length
    // The `register` endpoint requires 8 characters. Previously, `addPassword` only required 6,
    // allowing Google-sign-in users to set weaker passwords than direct registrations.
    // Now both are consistent at 8 characters minimum.
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    // Hash the new password before storing (never store plain text!)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the user's password field in the database
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


// ─────────────────────────────────────────────
// 🗑️ DELETE ACCOUNT — Remove user and all their data
// ─────────────────────────────────────────────
// DELETE /api/user/account
// This is a hard delete — everything is permanently removed.
// We delete the user first, then clean up all their related data.
export const deleteAccount = async (req, res) => {
  try {
    // Step 1: Delete the user document from the User collection
    const user = await User.findByIdAndDelete(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Step 2: Clean up all data associated with this user.
    // deleteMany() removes all documents that match the filter.
    // We must delete these or they become "orphaned" data with no owner.
    await SavedPaper.deleteMany({ user_id: req.userId });     // remove their saved papers
    await Project.deleteMany({ user_id: req.userId });        // remove their research projects
    await ReadingProgress.deleteMany({ user_id: req.userId }); // remove their reading history

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ success: false, error: 'Failed to delete account' });
  }
};
