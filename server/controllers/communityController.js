import { Community, CommunityMember, CommunityPost, User, Paper, JoinRequest } from '../models/index.js';

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
      // Create a join request instead
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

    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found' });

    const isMember = await CommunityMember.findOne({ community_id: req.params.id, user_id: req.userId });
    if (!isMember) return res.status(403).json({ success: false, error: 'You must join this community to post' });

    const post = new CommunityPost({
      community_id: req.params.id,
      user_id: req.userId,
      content: content.trim(),
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
