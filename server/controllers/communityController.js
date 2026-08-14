import { Community, CommunityMember, CommunityPost, User, Paper, JoinRequest } from '../models/index.js';
import { sendEmail } from '../utils/email.js';
import xss from 'xss';

// [SECURITY - N-C2]: Escape regex metacharacters to prevent ReDoS attacks
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const getAllCommunities = async (req, res) => {
  try {
    const { search, subject } = req.query;
    
    let query = {};
    if (search) {
      const q = new RegExp(escapeRegex(search), 'i');
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
    
    // ⚡ PERFORMANCE FIX: Before, we were fetching member count, post count, and membership status
    // one by one (sequentially), which meant waiting for each query to finish before starting the next.
    // Now, we fire ALL queries at the same time using Promise.all — like opening 3 browser tabs at once.
    // This makes the community list load significantly faster.
    const result = await Promise.all(communities.map(async (community) => {
      const [membersCount, postsCount, isMember] = await Promise.all([
        CommunityMember.countDocuments({ community_id: community._id }),
        CommunityPost.countDocuments({ community_id: community._id }),
        CommunityMember.findOne({ community_id: community._id, user_id: req.userId }).lean()
      ]);

      return {
        ...community,
        id: community._id,
        memberCount: membersCount,
        postCount: postsCount,
        isMember: !!isMember  // converts MongoDB object to true/false
      };
    }));

    result.sort((a, b) => b.memberCount - a.memberCount);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching communities:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch communities' });
  }
};

export const getCommunityById = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id).lean();
    if (!community) return res.status(404).json({ success: false, error: 'Community not found' });

    // ⚡ PERFORMANCE FIX: Instead of fetching membership status, member list, and posts one after another,
    // we now fire all 3 database queries at the exact same time using Promise.all.
    // This is the main reason the community card now loads much faster.
    const [isMemberDoc, membersRaw, postsRaw] = await Promise.all([
      CommunityMember.findOne({ community_id: community._id, user_id: req.userId }).lean(),  // is the current user a member?
      CommunityMember.find({ community_id: community._id }).populate('user_id').lean(),        // fetch the full members list
      CommunityPost.find({ community_id: community._id })                                      // fetch all posts in this community
        .populate('user_id')     // also get the author's profile info
        .populate('paper_ids')   // also get the full paper details for each attachment
        .sort({ created_at: -1 }) // newest posts first
    ]);

    const membersCount = membersRaw.length;
    const isMember = !!isMemberDoc; // converts to simple true/false

    // [SECURITY]: Content Hiding for Private Communities
    // If the community is private and the user is not a member, we intentionally 
    // hide all posts and member data from the API response payload.
    if (community.is_private && !isMember) {
      return res.json({
        success: true,
        data: {
          ...community,
          id: community._id,
          memberCount: membersCount,
          postCount: postsRaw.length,
          isMember,
          members: [], // Hidden
          posts: [],   // Hidden
        },
      });
    }

    const memberDetails = membersRaw.map(m => {
      const u = m.user_id;
      return u ? { id: u._id, name: u.name, avatar_initials: u.avatar_initials, avatar_url: u.avatar_url, role: u.role, joined_at: m.joined_at } : null;
    }).filter(Boolean);

    const enrichedPosts = postsRaw.map(post => {
      const author = post.user_id;
      const papers = post.paper_ids || [];
      return {
        ...post.toJSON(),
        author: author ? { name: author.name, avatar_initials: author.avatar_initials, avatar_url: author.avatar_url, role: author.role } : null,
        papers: papers.map(paper => paper ? { id: paper._id, title: paper.title, authors: paper.authors, year: paper.year, citations: paper.citations } : null).filter(Boolean),
      };
    });

    res.json({
      success: true,
      data: {
        ...community,
        id: community._id,
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

    // [SECURITY - HIGH-03]: Input Length Caps (DoS & Payload Bloat Prevention)
    // Validate text field lengths to prevent attackers from sending multi-megabyte payloads.
    if (name.length > 150) {
      return res.status(400).json({ success: false, error: 'Community name must be 150 characters or fewer' });
    }
    if (subject.length > 100) {
      return res.status(400).json({ success: false, error: 'Subject must be 100 characters or fewer' });
    }
    if (description && description.length > 2000) {
      return res.status(400).json({ success: false, error: 'Description must be 2000 characters or fewer' });
    }

    const community = new Community({
      name: name.trim(),
      description: description ? description.trim() : '',
      subject: subject.trim(),
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

// ✅ NEW: This function saves the admin's community card edits (cover photo, link, guidelines) to MongoDB.
// It is called when the admin clicks the 'Save' button in the Edit panel of the About card.
export const updateCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found' });

    // Only the creator or an admin-role member is allowed to make changes
    const isAdmin = community.created_by === req.userId || !!(await CommunityMember.findOne({ community_id: req.params.id, user_id: req.userId, role: 'admin' }));
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Only admins can update this community' });

    const { cover_photo, link, guidelines_link } = req.body;

    // [SECURITY - HIGH-03]: Input Length Validation for Community Edits
    if (link !== undefined && typeof link === 'string' && link.length > 500) {
      return res.status(400).json({ success: false, error: 'Link must be 500 characters or fewer' });
    }
    if (guidelines_link !== undefined && typeof guidelines_link === 'string' && guidelines_link.length > 500) {
      return res.status(400).json({ success: false, error: 'Guidelines link must be 500 characters or fewer' });
    }

    if (cover_photo !== undefined) {
      // [SECURITY - N-M3]: Cap cover photo size at 2MB.
      // Unlimited base64 strings can bloat MongoDB documents toward the 16MB doc limit.
      const MAX_COVER_SIZE = 2 * 1024 * 1024; // 2MB in chars (base64 ~= file size)
      if (typeof cover_photo === 'string' && cover_photo.length > MAX_COVER_SIZE) {
        return res.status(400).json({ success: false, error: 'Cover photo must be under 2MB' });
      }
      community.cover_photo = cover_photo;
    }
    if (link !== undefined) community.link = link;
    if (guidelines_link !== undefined) community.guidelines_link = guidelines_link;

    await community.save(); // persist changes to MongoDB
    res.json({ success: true, data: community });
  } catch (error) {
    console.error('Error updating community:', error);
    res.status(500).json({ success: false, error: 'Failed to update community' });
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

      // [FEATURE]: Email Notification on Join Request
      // Fire-and-forget email notification to admins so they don't have to constantly check the UI.
      try {
        const admins = await CommunityMember.find({ community_id: req.params.id, role: 'admin' }).populate('user_id', 'email');
        const creator = await User.findById(community.created_by).select('email');
        const adminEmails = [creator?.email, ...admins.map(m => m.user_id?.email)].filter(Boolean);
        const uniqueEmails = [...new Set(adminEmails)];
        const reqUser = await User.findById(req.userId).select('name');

        if (uniqueEmails.length > 0) {
          sendEmail({
            to: uniqueEmails.join(','),
            subject: 'New Join Request: ' + community.name,
            text: `${reqUser?.name || 'A user'} has requested to join your private community "${community.name}".\n\nLog in to ResearchHub to approve or deny this request.`
          });
        }
      } catch (err) {
        console.error('Failed to send join request emails:', err);
      }

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

    const request = await JoinRequest.findById(req.params.requestId).populate('user_id');
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });

    const isAdmin = await CommunityMember.findOne({ community_id: request.community_id, user_id: req.userId, role: 'admin' });
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Only admins can handle requests' });

    request.status = status;
    await request.save();

    if (status === 'accepted') {
      const newMember = new CommunityMember({
        community_id: request.community_id,
        user_id: request.user_id._id,
        role: 'member'
      });
      await newMember.save();
    }

    // [FEATURE]: Email Notification on Request Approval/Denial
    // Send an email to the user letting them know the status of their request.
    try {
      const community = await Community.findById(request.community_id);
      const targetUser = request.user_id;
      if (targetUser && targetUser.email && community) {
        sendEmail({
          to: targetUser.email,
          subject: `Community Request ${status === 'accepted' ? 'Approved' : 'Denied'}`,
          text: `Hi ${targetUser.name},\n\nYour request to join the private community "${community.name}" has been ${status === 'accepted' ? 'approved' : 'denied'}.\n\nLog in to ResearchHub to view the community.`
        });
      }
    } catch (err) {
      console.error('Failed to send status email:', err);
    }

    res.json({ success: true, message: `Request ${status}` });
  } catch (error) {
    console.error('Error handling join request:', error);
    res.status(500).json({ success: false, error: 'Failed to handle join request' });
  }
};

export const leaveCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found' });

    const memberRecord = await CommunityMember.findOne({ community_id: req.params.id, user_id: req.userId });
    if (!memberRecord) return res.status(404).json({ success: false, error: 'Not a member of this community' });

    const isCreator = String(community.created_by) === String(req.userId);
    const isAdmin = isCreator || memberRecord.role === 'admin';

    if (isAdmin) {
      const allMembers = await CommunityMember.find({ community_id: req.params.id });
      const otherAdmins = allMembers.filter(m => String(m.user_id) !== String(req.userId) && (m.role === 'admin' || String(m.user_id) === String(community.created_by)));
      
      if (otherAdmins.length === 0 && allMembers.length > 1) {
        return res.status(400).json({ success: false, error: 'You are the last admin. Please promote another member to admin before leaving.' });
      }
    }

    await CommunityMember.deleteOne({ _id: memberRecord._id });

    res.json({ success: true, message: 'Left community' });
  } catch (error) {
    console.error('Error leaving community:', error);
    res.status(500).json({ success: false, error: 'Failed to leave community' });
  }
};

export const createPost = async (req, res) => {
  try {
    const { content, paper_ids } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Post content is required' });
    }

    // [SECURITY - HIGH-03]: Input Length Validation for Community Posts
    // Prevents malicious memory exhaustion / database bloat by capping post text to 10,000 chars.
    const MAX_POST_LENGTH = 10000;
    if (content.length > MAX_POST_LENGTH) {
      return res.status(400).json({ success: false, error: `Post content must be ${MAX_POST_LENGTH} characters or fewer` });
    }

    // [SECURITY]: Input Sanitization (XSS Prevention)
    // We use the 'xss' library to strip out any potentially malicious HTML or JavaScript tags 
    // from the user's post content.
    const sanitizedContent = xss(content.trim());

    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found' });

    const isMember = await CommunityMember.findOne({ community_id: req.params.id, user_id: req.userId });
    if (!isMember) return res.status(403).json({ success: false, error: 'You must join this community to post' });

    const post = new CommunityPost({
      community_id: req.params.id,
      user_id: req.userId,
      content: sanitizedContent,
      paper_ids: paper_ids || [],
      likes: 0
    });
    await post.save();

    const author = await User.findById(req.userId);
    const papers = paper_ids && paper_ids.length > 0 ? await Paper.find({ _id: { $in: paper_ids } }) : [];

    res.status(201).json({
      success: true,
      data: {
        ...post.toJSON(),
        author: author ? { name: author.name, avatar_initials: author.avatar_initials, avatar_url: author.avatar_url, role: author.role } : null,
        papers: papers.map(paper => paper ? { id: paper._id, title: paper.title, authors: paper.authors, year: paper.year, citations: paper.citations } : null).filter(Boolean),
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
    // This is highly destructive, so we enforce a strict rule: ONLY the original creator can delete it.
    if (String(community.created_by) !== String(req.userId)) {
      return res.status(403).json({ success: false, error: 'Only the original creator can delete this community' });
    }

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
      // ─────────────────────────────────────────────────────────
      // BEFORE (slow):
      //   await sendEmail(...);
      //   res.json(...)  ← admin waited 2-5 seconds for email to send first
      //
      // AFTER (fast - fire and forget):
      //   sendEmail(...).catch(...)  ← email starts sending in the background
      //   res.json(...)  ← admin gets "Done!" response instantly, no waiting
      //   If email fails, it just logs the error — doesn't crash the request
      // ─────────────────────────────────────────────────────────
      sendEmail({
        to: userToAdd.email,
        subject: `You have been added to ${community.name}`,
        text: `Hello ${userToAdd.name},\n\nYou have been added to the community "${community.name}" by an admin.\n\nWelcome!`
      }).catch(err => console.error('Failed to send add-member email:', err));
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
      // BEFORE (slow): await sendEmail(...) — admin waited for email before getting response
      // AFTER (fast):  fire and forget — email sends in background, admin gets instant response
      sendEmail({
        to: userToRemove.email,
        subject: `You have been removed from ${community.name}`,
        text: `Hello ${userToRemove.name},\n\nYou have been removed from the community "${community.name}" by an admin.`
      }).catch(err => console.error('Failed to send remove-member email:', err));
    }

    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ success: false, error: 'Failed to remove member' });
  }
};

export const updateMemberRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) return res.status(400).json({ success: false, error: 'Invalid role' });
    
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found' });
    
    const isAdmin = String(community.created_by) === String(req.userId) || !!(await CommunityMember.findOne({ community_id: req.params.id, user_id: req.userId, role: 'admin' }));
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Only admins can update roles' });
    
    const memberToUpdate = await CommunityMember.findOne({ community_id: req.params.id, user_id: req.params.userId });
    if (!memberToUpdate) return res.status(404).json({ success: false, error: 'Member not found' });
    
    memberToUpdate.role = role;
    await memberToUpdate.save();
    
    res.json({ success: true, message: 'Member role updated' });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ success: false, error: 'Failed to update member role' });
  }
};

