import { Community, CommunityMember, CommunityPost, User, Paper, JoinRequest } from '../models/index.js';
import { sendEmail } from '../utils/email.js';
import xss from 'xss';

export const getAllCommunities = async (req, res) => {
  try {
    const { search, subject } = req.query;
    
    let query = {};
    if (search) {
      const q = new RegExp(search, 'i');
      query.$or = [
        { name: q },
        { description: q },
        { subject: q }
      ];
    }
    if (subject) {
      query.subject = subject;
    }

    const communities = await Community.find(query).lean();
    
    const result = [];
    for (const community of communities) {
      const membersCount = await CommunityMember.countDocuments({ community_id: community._id });
      const postsCount = await CommunityPost.countDocuments({ community_id: community._id });
      const isMember = await CommunityMember.findOne({ community_id: community._id, user_id: req.userId });

      result.push({
        ...community,
        id: community._id,
        memberCount: membersCount,
        postCount: postsCount,
        isMember: !!isMember
      });
    }

    result.sort((a, b) => b.memberCount - a.memberCount);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching communities:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch communities' });
  }
};

export const getCommunityById = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found' });

    const membersCount = await CommunityMember.countDocuments({ community_id: community._id });
    const isMember = !!(await CommunityMember.findOne({ community_id: community._id, user_id: req.userId }));

    const membersRaw = await CommunityMember.find({ community_id: community._id }).populate('user_id');
    const memberDetails = membersRaw.map(m => {
      const u = m.user_id;
      return u ? { id: u._id, name: u.name, avatar_initials: u.avatar_initials, avatar_url: u.avatar_url, role: u.role, joined_at: m.joined_at } : null;
    }).filter(Boolean);

    const postsRaw = await CommunityPost.find({ community_id: community._id })
      .populate('user_id')
      .populate('paper_id')
      .sort({ created_at: -1 });

    const enrichedPosts = postsRaw.map(post => {
      const author = post.user_id;
      const paper = post.paper_id;
      return {
        ...post.toJSON(),
        author: author ? { name: author.name, avatar_initials: author.avatar_initials, avatar_url: author.avatar_url, role: author.role } : null,
        paper: paper ? { id: paper._id, title: paper.title, authors: paper.authors, year: paper.year, citations: paper.citations } : null,
      };
    });

    res.json({
      success: true,
      data: {
        ...community.toJSON(),
        memberCount: membersCount,
        postCount: enrichedPosts.length,
        isMember,
        members: memberDetails,
        posts: enrichedPosts,
      },
    });
  } catch (error) {
    console.error('Error fetching community:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch community' });
  }
};

export const createCommunity = async (req, res) => {
  try {
    const { name, description, subject, icon, is_private, allow_invites } = req.body;
    if (!name || !subject) {
      return res.status(400).json({ success: false, error: 'name and subject are required' });
    }

    const community = new Community({
      name,
      description: description || '',
      subject,
      icon: icon || '🔬',
      created_by: req.userId,
      is_private: is_private || false,
      allow_invites: allow_invites !== undefined ? allow_invites : true
    });

    await community.save();

    // [SECURITY]: Role Assignment (Privilege Escalation Prevention)
    // The user who creates the community is automatically assigned the 'admin' role, 
    // securely tying administrative privileges only to the creator initially.
    const initialMember = new CommunityMember({
      community_id: community._id,
      user_id: req.userId,
      role: 'admin'
    });
    
    await initialMember.save();

    res.status(201).json({
      success: true,
      data: { ...community.toJSON(), memberCount: 1, postCount: 0, isMember: true },
    });
  } catch (error) {
    console.error('Error creating community:', error);
    res.status(500).json({ success: false, error: 'Failed to create community' });
  }
};

export const joinCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found' });

    const existing = await CommunityMember.findOne({ community_id: req.params.id, user_id: req.userId });
    if (existing) return res.status(409).json({ success: false, error: 'Already a member' });

    if (community.is_private) {
      // [SECURITY]: Access Control (Private Communities)
      // If a community is private, users cannot bypass this check to join directly.
      // We log a 'JoinRequest' which must be explicitly approved by an authorized admin.
      const existingRequest = await JoinRequest.findOne({ community_id: req.params.id, user_id: req.userId, status: 'pending' });
      if (existingRequest) {
        return res.status(409).json({ success: false, error: 'Request already pending' });
      }

      const request = new JoinRequest({
        community_id: req.params.id,
        user_id: req.userId
      });
      await request.save();
      return res.json({ success: true, message: 'Join request sent', status: 'pending' });
    }

    const newMember = new CommunityMember({
      community_id: req.params.id,
      user_id: req.userId,
      role: 'member'
    });
    await newMember.save();

    res.json({ success: true, message: 'Joined community' });
  } catch (error) {
    console.error('Error joining community:', error);
    res.status(500).json({ success: false, error: 'Failed to join community' });
  }
};

export const getJoinRequests = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found' });

    // [SECURITY]: Authorization Check (Admin Only Access)
    // We query the database to verify the requesting user's role for this specific community.
    // Sensitive data like join requests is strictly protected from regular members.
    const isAdmin = await CommunityMember.findOne({ community_id: req.params.id, user_id: req.userId, role: 'admin' });
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Only admins can view requests' });

    const requests = await JoinRequest.find({ community_id: req.params.id, status: 'pending' }).populate('user_id');
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Error fetching join requests:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch join requests' });
  }
};

export const handleJoinRequest = async (req, res) => {
  try {
    const { status } = req.body; // 'accepted' or 'rejected'
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const request = await JoinRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });

    const isAdmin = await CommunityMember.findOne({ community_id: request.community_id, user_id: req.userId, role: 'admin' });
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Only admins can handle requests' });

    request.status = status;
    await request.save();

    if (status === 'accepted') {
      const newMember = new CommunityMember({
        community_id: request.community_id,
        user_id: request.user_id,
        role: 'member'
      });
      await newMember.save();
    }

    res.json({ success: true, message: `Request ${status}` });
  } catch (error) {
    console.error('Error handling join request:', error);
    res.status(500).json({ success: false, error: 'Failed to handle join request' });
  }
};

export const leaveCommunity = async (req, res) => {
  try {
    const result = await CommunityMember.deleteOne({ community_id: req.params.id, user_id: req.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Not a member of this community' });
    }

    res.json({ success: true, message: 'Left community' });
  } catch (error) {
    console.error('Error leaving community:', error);
    res.status(500).json({ success: false, error: 'Failed to leave community' });
  }
};

export const createPost = async (req, res) => {
  try {
    const { content, paper_id } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Post content is required' });
    }

    // [SECURITY]: Input Sanitization (XSS Prevention)
    // We use the 'xss' library to strip out any potentially malicious HTML or JavaScript tags 
    // from the user's post content. This ensures that if a user types something like <script>alert('hacked')</script>, 
    // it gets safely neutralized and won't execute on other users' browsers when they view the post.
    const sanitizedContent = xss(content.trim());

    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found' });

    const isMember = await CommunityMember.findOne({ community_id: req.params.id, user_id: req.userId });
    if (!isMember) return res.status(403).json({ success: false, error: 'You must join this community to post' });

    const post = new CommunityPost({
      community_id: req.params.id,
      user_id: req.userId,
      content: sanitizedContent,
      paper_id: paper_id || null,
      likes: 0
    });
    await post.save();

    const author = await User.findById(req.userId);
    const paper = paper_id ? await Paper.findById(paper_id) : null;

    res.status(201).json({
      success: true,
      data: {
        ...post.toJSON(),
        author: author ? { name: author.name, avatar_initials: author.avatar_initials, avatar_url: author.avatar_url, role: author.role } : null,
        paper: paper ? { id: paper._id, title: paper.title, authors: paper.authors, year: paper.year, citations: paper.citations } : null,
      },
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ success: false, error: 'Failed to create post' });
  }
};

export const deletePost = async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.postId);
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
    
    // [SECURITY]: Resource Ownership Validation (IDOR Prevention)
    // Insecure Direct Object Reference (IDOR) occurs when an application provides direct access 
    // to objects based on user-supplied input. Here, we prevent it by validating that the user 
    // making the request is the actual author of the post.
    if (String(post.user_id) !== String(req.userId)) {
      return res.status(403).json({ success: false, error: 'You can only delete your own posts' });
    }

    await CommunityPost.deleteOne({ _id: post._id });
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ success: false, error: 'Failed to delete post' });
  }
};

export const deleteCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found' });

    // [SECURITY]: Critical Action Authorization
    // Deleting a community cascades and deletes all posts, members, and requests.
    // This is highly destructive, so we enforce a strict authorization gate requiring 'admin' role.
    const isAdmin = await CommunityMember.findOne({ community_id: req.params.id, user_id: req.userId, role: 'admin' });
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Only admins can delete a community' });

    await Community.deleteOne({ _id: community._id });
    await CommunityMember.deleteMany({ community_id: community._id });
    await CommunityPost.deleteMany({ community_id: community._id });
    await JoinRequest.deleteMany({ community_id: community._id });

    res.json({ success: true, message: 'Community deleted successfully' });
  } catch (error) {
    console.error('Error deleting community:', error);
    res.status(500).json({ success: false, error: 'Failed to delete community' });
  }
};

export const addMember = async (req, res) => {
  try {
    const { userId, email } = req.body;
    if (!userId && !email) return res.status(400).json({ success: false, error: 'User ID or Email is required' });

    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found' });

    const isAdmin = await CommunityMember.findOne({ community_id: req.params.id, user_id: req.userId, role: 'admin' });
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Only admins can add members' });

    let userToAdd;
    if (userId) {
      userToAdd = await User.findById(userId);
    } else if (email) {
      userToAdd = await User.findOne({ email });
    }
    
    if (!userToAdd) return res.status(404).json({ success: false, error: 'User not found' });

    const existingMember = await CommunityMember.findOne({ community_id: req.params.id, user_id: userToAdd._id });
    if (existingMember) return res.status(409).json({ success: false, error: 'User is already a member' });

    const newMember = new CommunityMember({
      community_id: req.params.id,
      user_id: userToAdd._id,
      role: 'member'
    });
    await newMember.save();

    if (community.is_private) {
      await sendEmail({
        to: userToAdd.email,
        subject: `You have been added to ${community.name}`,
        text: `Hello ${userToAdd.name},\n\nYou have been added to the community "${community.name}" by an admin.\n\nWelcome!`
      });
    }

    res.json({ success: true, message: 'Member added successfully', data: { id: userToAdd._id, name: userToAdd.name } });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ success: false, error: 'Failed to add member' });
  }
};

export const removeMember = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found' });

    const isAdmin = await CommunityMember.findOne({ community_id: req.params.id, user_id: req.userId, role: 'admin' });
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Only admins can remove members' });

    if (req.userId === req.params.userId) {
       return res.status(400).json({ success: false, error: 'You cannot remove yourself using this endpoint. Use leave endpoint instead.' });
    }

    const memberToRemove = await CommunityMember.findOne({ community_id: req.params.id, user_id: req.params.userId });
    if (!memberToRemove) return res.status(404).json({ success: false, error: 'Member not found in this community' });

    const userToRemove = await User.findById(req.params.userId);

    await CommunityMember.deleteOne({ _id: memberToRemove._id });

    if (community.is_private && userToRemove) {
      await sendEmail({
        to: userToRemove.email,
        subject: `You have been removed from ${community.name}`,
        text: `Hello ${userToRemove.name},\n\nYou have been removed from the community "${community.name}" by an admin.`
      });
    }

    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ success: false, error: 'Failed to remove member' });
  }
};

