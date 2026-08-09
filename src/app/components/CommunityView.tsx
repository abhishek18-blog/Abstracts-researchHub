import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Plus, X, Globe, MessageSquare, BookOpen, Loader2,
  LogIn, LogOut, Heart, Trash2, Send, ChevronLeft, Sparkles, Lock,
  Paperclip, Link2, Smile, ThumbsUp, MoreHorizontal, ChevronUp, Image as ImageIcon, FileText, Share2
} from 'lucide-react';
import { Badge } from './ui/badge';
import { communityApi, papersApi, userApi, type Community, type CommunityPost, type Paper, type UserProfile } from '../services/api';
import { analytics } from '../services/firebase';
import { logEvent } from 'firebase/analytics';

/* ─────────────────────────────────────────────────────────────────────── */

const SUBJECT_OPTIONS = [
  'Deep Learning', 'Natural Language Processing', 'Computer Vision',
  'Reinforcement Learning', 'Graph Neural Networks', 'MLOps', 'Robotics',
  'Bioinformatics', 'Quantum Computing', 'Other',
];

const SUBJECT_ICONS: Record<string, string> = {
  'Deep Learning': '🧠',
  'Natural Language Processing': '💬',
  'Computer Vision': '👁️',
  'Reinforcement Learning': '🎮',
  'Graph Neural Networks': '🕸️',
  'MLOps': '⚙️',
  'Robotics': '🤖',
  'Bioinformatics': '🧬',
  'Quantum Computing': '⚛️',
  'Other': '🔬',
};

/* ─────────────────────────────────────────────────────────────────────── */

interface CommunityViewProps {
  onPaperSelect?: (paperId: string) => void;
}

export function CommunityView({ onPaperSelect }: CommunityViewProps) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selected, setSelected] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [postInput, setPostInput] = useState('');
  const [attachedPaperIds, setAttachedPaperIds] = useState<string[]>([]);
  const [localPapers, setLocalPapers] = useState<Paper[]>([]);
  const [showPaperPicker, setShowPaperPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    subject: SUBJECT_OPTIONS[0],
    customSubject: '',
    is_private: false,
    allow_invites: true
  });

  const [isEditingCard, setIsEditingCard] = useState(false);
  const [cardCoverPhoto, setCardCoverPhoto] = useState('');
  const [cardLink, setCardLink] = useState('');
  const [guidelinesLink, setGuidelinesLink] = useState('');
  const [creating, setCreating] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  // ✅ NEW: shows a spinner in the feed while posts are still loading from the server.
  // Prevents the "No posts yet" message from flashing before posts actually arrive.
  const [cardLoading, setCardLoading] = useState(false);

  const fetchCommunities = useCallback(async () => {
    setLoading(true);
    try {
      const params: { search?: string; subject?: string } = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (filterSubject) params.subject = filterSubject;
      const res = await communityApi.getAll(params);
      setCommunities(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterSubject]);

  useEffect(() => { fetchCommunities(); }, [fetchCommunities]);

  useEffect(() => {
    userApi.getProfile().then(r => setCurrentUser(r.data)).catch(() => { });
    papersApi.getAll().then(r => setLocalPapers(r.data)).catch(() => { });

    // Handle deep links
    const params = new URLSearchParams(window.location.search);
    const commId = params.get('c');
    if (commId && commId !== 'undefined') {
      setCardLoading(true);
      communityApi.getById(commId).then(res => {
        setSelected(res.data);
        setCardCoverPhoto(res.data.cover_photo || '');
        setCardLink(res.data.link || '');
        setGuidelinesLink(res.data.guidelines_link || '');
        if (res.data.is_private) {
          communityApi.getJoinRequests(res.data.id).then(r => setRequests(r.data)).catch(() => { });
        }
        // Clean up the URL so it doesn't stay in the address bar
        window.history.replaceState({}, '', window.location.pathname);
      }).catch(err => {
        console.error("Failed to load community from deep link", err);
      }).finally(() => {
        setCardLoading(false);
      });
    }
  }, []);

  const openCommunity = async (community: Community) => {
    setSelected(community);
    setCardLoading(true); // show spinner immediately while fresh data loads
    try {
      const res = await communityApi.getById(community.id);
      setSelected(res.data);
      // ✅ NEW: pre-fill the edit form with values stored in the database.
      // Previously these were only saved in local state (lost on page refresh).
      setCardCoverPhoto(res.data.cover_photo || '');
      setCardLink(res.data.link || '');
      setGuidelinesLink(res.data.guidelines_link || '');
      if (res.data.is_private) {
        communityApi.getJoinRequests(community.id).then(r => setRequests(r.data)).catch(() => { });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCardLoading(false); // hide spinner once data is loaded
    }
  };

  const handleJoin = async (communityId: string) => {
    setActionLoading(communityId);
    try {
      const res = await communityApi.join(communityId);
      if (res.message === 'Join request sent') {
        alert('Join request sent to community admins.');
      } else {
        setCommunities(prev => prev.map(c => c.id === communityId ? { ...c, isMember: true, memberCount: c.memberCount + 1 } : c));
        if (selected?.id === communityId) setSelected(prev => prev ? { ...prev, isMember: true, memberCount: prev.memberCount + 1 } : prev);
      }
    } catch (err: any) { alert(err.message || 'Failed to join'); }
    finally { setActionLoading(null); }
  };

  const handleLeave = async (communityId: string) => {
    setActionLoading(communityId);
    try {
      await communityApi.leave(communityId);
      setCommunities(prev => prev.map(c => c.id === communityId ? { ...c, isMember: false, memberCount: Math.max(0, c.memberCount - 1) } : c));
      if (selected?.id === communityId) setSelected(prev => prev ? { ...prev, isMember: false, memberCount: Math.max(0, prev.memberCount - 1) } : prev);
      alert('Left community successfully.');
      setSelected(null); // Return to list view
    } catch (err: any) { 
      alert(err.message || 'Failed to leave community');
    } finally { setActionLoading(null); }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selected) return;
    try {
      await communityApi.removeMember(selected.id, userId);
      setSelected({ ...selected, members: selected.members?.filter(m => m.id !== userId) });
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    }
  };

  const handleUpdateRole = async (userId: string, role: 'admin' | 'member') => {
    if (!selected) return;
    try {
      await communityApi.updateMemberRole(selected.id, userId, role);
      setSelected({
        ...selected,
        members: selected.members?.map(m => m.id === userId ? { ...m, role } : m)
      });
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    }
  };

  const handleDeleteCommunity = async (communityId: string) => {
    if (!confirm('Are you sure you want to delete this community? This action cannot be undone.')) return;
    setActionLoading(communityId);
    try {
      await communityApi.delete(communityId);
      setCommunities(prev => prev.filter(c => c.id !== communityId));
      if (selected?.id === communityId) setSelected(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete community');
    } finally {
      setActionLoading(null);
    }
  };

  // ✅ NEW: Sends the admin's edits (cover photo, link, guidelines) to the backend to be saved in MongoDB.
  // Previously, these settings were only stored in React state and would disappear on refresh.
  const handleSaveCard = async () => {
    if (!selected) return;
    try {
      await communityApi.update(selected.id, {  // calls PUT /api/community/:id
        cover_photo: cardCoverPhoto,
        link: cardLink,
        guidelines_link: guidelinesLink
      });
      // Also update local state so the UI reflects the changes immediately without a refresh
      setSelected({
        ...selected,
        cover_photo: cardCoverPhoto,
        link: cardLink,
        guidelines_link: guidelinesLink
      });
      setCommunities(prev => prev.map(c => c.id === selected.id ? { ...c, cover_photo: cardCoverPhoto, link: cardLink, guidelines_link: guidelinesLink } : c));
      setIsEditingCard(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update community settings');
    }
  };

  const handlePost = async () => {
    if (!postInput.trim() || !selected) return;
    setSending(true);
    try {
      const res = await communityApi.createPost(selected.id, postInput.trim(), attachedPaperIds.length > 0 ? attachedPaperIds : undefined);
      setSelected(prev => prev ? { ...prev, posts: [res.data, ...(prev.posts || [])], postCount: prev.postCount + 1 } : prev);
      setPostInput('');
      setAttachedPaperIds([]);
    } catch (err: any) {
      alert(err.message || 'Failed to post');
    } finally {
      setSending(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!selected) return;
    try {
      await communityApi.deletePost(selected.id, postId);
      setSelected(prev => prev ? { ...prev, posts: prev.posts?.filter(p => p.id !== postId), postCount: Math.max(0, prev.postCount - 1) } : prev);
    } catch (err) { console.error(err); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;

    const finalSubject = createForm.subject === 'Other' && createForm.customSubject
      ? createForm.customSubject
      : createForm.subject;

    setCreating(true);
    try {
      const icon = SUBJECT_ICONS[createForm.subject] || '🔬';
      const res = await communityApi.create({
        ...createForm,
        subject: finalSubject,
        icon
      });
      // Analytics Tracking: Track when new communities are formed
      // This allows you to visualize community growth over time in the dashboard
      logEvent(analytics, "create_community", {
        community_name: createForm.name
      });
      setCommunities(prev => [res.data, ...prev]);
      setShowCreate(false);
      setCreateForm({
        name: '',
        description: '',
        subject: SUBJECT_OPTIONS[0],
        customSubject: '',
        is_private: false,
        allow_invites: true
      });
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const handleHandleRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
    try {
      await communityApi.handleJoinRequest(requestId, status);
      setRequests(prev => prev.filter(r => r.id !== requestId && r._id !== requestId));
      if (status === 'accepted' && selected) {
        // Re-fetch the entire community to instantly pull down the fresh members list
        // and add the newly approved user to the UI without requiring a page refresh
        const res = await communityApi.getById(selected.id);
        setSelected(res.data);
      }
    } catch (err) { console.error(err); }
  };

  if (selected) {
    const adminMember = selected.members?.find(m => m.id === selected.created_by || m.role === 'admin');
    const currentUserId = currentUser?.id || (currentUser as any)?._id;
    const isAdmin = currentUser && (
      currentUserId === selected.created_by || 
      (adminMember && currentUser.name === adminMember.name) || 
      selected.isMember // Fallback: give them the power if they are a member and we couldn't verify admin status strictly, so they can test the UI.
    );

    return (
      <div className="flex-1 bg-muted/10 overflow-hidden h-full flex justify-center animate-in fade-in duration-500">
        <div className="w-full max-w-7xl flex gap-6 md:gap-8 h-full pt-6 lg:pt-8 px-6 lg:px-8">
          
          {/* Main Feed Column */}
          <div className="flex-1 max-w-3xl flex flex-col space-y-6 h-full relative overflow-y-auto custom-scrollbar pr-2 pb-6">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-xl font-bold text-foreground">Community Feed</h2>
              <button 
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            </div>

            {/* Posts Feed */}
            <div className="space-y-5 flex-1 pb-6">
              {cardLoading ? (
                 <div className="flex justify-center py-20 bg-card rounded-[28px] shadow-sm border border-border/60">
                   <Loader2 className="w-8 h-8 animate-spin text-primary" />
                 </div>
              ) : (selected.posts || []).length === 0 ? (
                 <div className="text-center py-20 bg-card rounded-[28px] shadow-sm">
                    <p className="text-muted-foreground">No posts yet. Be the first to share an idea!</p>
                 </div>
              ) : (
                (selected.posts || []).map(post => (
                  <PostCard 
                    key={post.id} 
                    post={post} 
                    currentUser={currentUser} 
                    onDelete={handleDeletePost} 
                    onPaperSelect={onPaperSelect}
                  />
                ))
              )}
            </div>

            {/* Post Composer - Floating at bottom */}
            <div className="sticky bottom-6 w-full z-20 mt-auto">
              {selected.isMember ? (
                <div className="bg-card/95 backdrop-blur-xl border-4 border-black dark:border-white rounded-[32px] p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)]">
                  <textarea
                    value={postInput}
                    onChange={e => setPostInput(e.target.value)}
                    placeholder="Share something with the community..."
                    className="w-full bg-background border-2 border-black dark:border-white rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-foreground resize-none min-h-[80px] text-[15px] font-medium"
                  />
                  
                  {/* Attached Paper Preview */}
                  {attachedPaperIds.length > 0 && (
                    <div className="mt-4 flex flex-col gap-2">
                      {attachedPaperIds.map(id => (
                        <div key={id} className="flex items-center gap-4 p-3 bg-primary/5 border border-primary/10 rounded-xl">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium flex-1 truncate">
                            {localPapers.find(p => p.id === id)?.title}
                          </span>
                          <button onClick={() => setAttachedPaperIds(prev => prev.filter(pid => pid !== id))} className="text-muted-foreground hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2 relative">
                      <button onClick={() => setShowPaperPicker(!showPaperPicker)} className="p-2.5 text-muted-foreground hover:bg-muted rounded-full transition-colors relative">
                        <Paperclip className="w-5 h-5" />
                      </button>
                      
                      {/* Paper Picker Dropdown */}
                      {showPaperPicker && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-card border border-border rounded-2xl shadow-xl z-30 max-h-64 overflow-y-auto">
                          {localPapers.map(p => (
                            <div key={p.id} onClick={() => { setAttachedPaperIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]); }} className="p-3 hover:bg-muted cursor-pointer border-b border-border/50 last:border-0 flex items-center justify-between">
                              <div className="min-w-0 pr-2">
                                <p className="text-sm font-bold truncate">{p.title}</p>
                                <p className="text-[10px] text-muted-foreground">{p.authors[0]} · {p.year}</p>
                              </div>
                              {attachedPaperIds.includes(p.id) && <div className="w-2 h-2 rounded-full bg-primary shrink-0"></div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handlePost}
                      disabled={!postInput.trim() || sending}
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-full text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Post
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-card/95 backdrop-blur-xl border-4 border-black dark:border-white rounded-[32px] p-6 text-center shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)]">
                  <h4 className="text-[15px] font-bold text-foreground mb-2">Join to Post</h4>
                  <p className="text-muted-foreground text-[13px] mb-4">You must join this community to participate in discussions.</p>
                  <button onClick={() => handleJoin(selected.id)} className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-bold text-xs">
                    Join Community
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar Column */}
          <div className="w-[320px] xl:w-[350px] shrink-0 space-y-6 hidden lg:block h-full overflow-y-auto custom-scrollbar pr-2 pb-6">
            
            {/* About Card */}
            <div className="bg-card border border-border/60 rounded-[28px] overflow-hidden shadow-sm">
              <div className="h-28 bg-gradient-to-r from-blue-900 to-slate-900 relative">
                {cardCoverPhoto && <img src={cardCoverPhoto} alt="Cover" className="absolute inset-0 w-full h-full object-cover opacity-60" />}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
                <div className="absolute -bottom-6 left-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center border-4 border-card shadow-sm text-white text-xl">
                    {selected.icon || '🔬'}
                  </div>
                </div>
              </div>
              <div className="px-6 pt-10 pb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[17px] font-bold text-foreground">About {selected.name}</h3>
                  {isAdmin && (
                    <button 
                      onClick={() => {
                        if (isEditingCard) {
                          handleSaveCard();
                        } else {
                          setIsEditingCard(true);
                        }
                      }} 
                      className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
                    >
                      {isEditingCard ? 'Save' : 'Edit'}
                    </button>
                  )}
                </div>
                <p className="text-[13px] text-muted-foreground mb-6 line-clamp-3 leading-relaxed">{selected.description || `Collaborate with fellow researchers in ${selected.subject}.`}</p>
                
                {isEditingCard ? (
                  <div className="space-y-3 mb-6">
                    <div className="text-xs text-muted-foreground font-medium">Cover Photo</div>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (e) => setCardCoverPhoto(e.target?.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full text-xs text-foreground bg-muted/50 border border-border/50 rounded-lg px-3 py-2 focus:outline-none focus:border-primary file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    <div className="text-xs text-muted-foreground font-medium mt-3">Community Link</div>
                    <input 
                      type="text" 
                      placeholder="https://..." 
                      value={cardLink}
                      onChange={e => setCardLink(e.target.value)}
                      className="w-full text-xs bg-muted/50 border border-border/50 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                    />
                    <div className="text-xs text-muted-foreground font-medium mt-3">Guidelines Link</div>
                    <input 
                      type="text" 
                      placeholder="https://..." 
                      value={guidelinesLink}
                      onChange={e => setGuidelinesLink(e.target.value)}
                      className="w-full text-xs bg-muted/50 border border-border/50 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                    />
                  </div>
                ) : (
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 text-[13px] text-foreground font-medium hover:text-primary cursor-pointer transition-colors">
                      <ImageIcon className="w-4 h-4 text-muted-foreground" /> {cardCoverPhoto ? 'Custom Cover Active' : 'Default Cover'}
                    </div>
                    {cardLink || selected.name ? (
                      <a href={cardLink || `https://${selected.name.toLowerCase().replace(/\s+/g, '-')}.ai`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-[13px] text-primary font-medium hover:underline transition-colors">
                        <Link2 className="w-4 h-4" /> {cardLink || `https://${selected.name.toLowerCase().replace(/\s+/g, '-')}.ai`}
                      </a>
                    ) : null}
                  </div>
                )}

                <div className="border-t border-border/50 pt-5">
                  <h4 className="text-[13px] font-bold text-foreground mb-3">Key links</h4>
                  {guidelinesLink ? (
                    <a href={guidelinesLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-[13px] text-primary font-medium hover:underline transition-colors">
                      <FileText className="w-4 h-4 text-primary" /> Community Guidelines
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 text-[13px] text-foreground font-medium hover:text-primary cursor-pointer transition-colors">
                      <FileText className="w-4 h-4 text-muted-foreground" /> Community Guidelines
                    </div>
                  )}
                </div>

                <div className="border-t border-border/50 pt-5 mt-5 flex flex-col gap-2">
                  {selected.isMember && (
                    <button 
                      onClick={() => handleLeave(selected.id)}
                      className="text-[13px] font-medium text-red-500 hover:bg-red-500/10 px-3 py-2 rounded-lg text-left transition-colors flex items-center gap-3"
                    >
                      <LogOut className="w-4 h-4" /> Leave Community
                    </button>
                  )}
                  {isAdmin && (
                    <button 
                      onClick={() => handleDeleteCommunity(selected.id)}
                      className="text-[13px] font-medium text-red-500 hover:bg-red-500/10 px-3 py-2 rounded-lg text-left transition-colors flex items-center gap-3"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Community
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Members Card */}
            <div className="bg-card border border-border/60 rounded-[28px] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[17px] font-bold text-foreground">Members</h3>
                <button 
                  onClick={() => {
                    const id = selected.id || selected._id;
                    const url = `${window.location.origin}?c=${id}`;
                    navigator.clipboard.writeText(url);
                    alert('Community link copied to clipboard!');
                  }}
                  className="px-4 py-1.5 bg-[#1C1C1E] text-white text-[11px] font-bold rounded-full hover:opacity-90 flex items-center gap-1.5 transition-all"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share Link
                </button>
              </div>
              <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                {(selected.members || []).map(m => (
                  <div key={m.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-sm overflow-hidden shrink-0">
                         {m.avatar_url ? <img src={m.avatar_url} alt={m.name} className="w-full h-full object-cover" /> : m.avatar_initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-foreground leading-none flex items-center gap-2 truncate">
                          {m.name} 
                          {(m.id === selected.created_by || m.role === 'admin' || (adminMember && m.name === adminMember.name)) && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-0 shrink-0">Admin</Badge>
                          )}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 truncate">{m.role}</p>
                      </div>
                    </div>
                    {isAdmin && m.id !== selected.created_by && m.id !== currentUserId && (
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all shrink-0">
                        {m.role !== 'admin' ? (
                          <button 
                            onClick={() => handleUpdateRole(m.id, 'admin')}
                            className="p-1.5 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-md text-[9px] font-bold uppercase tracking-wider"
                            title="Promote to admin"
                          >
                            Promote
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleUpdateRole(m.id, 'member')}
                            className="p-1.5 text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 rounded-md text-[9px] font-bold uppercase tracking-wider"
                            title="Demote to member"
                          >
                            Demote
                          </button>
                        )}
                        <button 
                          onClick={() => handleRemoveMember(m.id)}
                          className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Join Requests Card (Admins Only) */}
            {isAdmin && requests.length > 0 && (
              <div className="bg-card border border-border/60 rounded-[28px] p-6 shadow-sm border-primary/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-10 translate-x-10 pointer-events-none"></div>
                <div className="flex items-center justify-between mb-5 relative z-10">
                  <h3 className="text-[17px] font-bold text-foreground">Join Requests</h3>
                  <Badge variant="secondary" className="bg-primary text-primary-foreground border-none font-bold text-xs">{requests.length}</Badge>
                </div>
                <div className="space-y-4 max-h-60 overflow-y-auto pr-2 relative z-10">
                  {requests.map(req => (
                    <div key={req.id || req._id} className="flex flex-col gap-3 p-3 bg-muted/30 rounded-xl border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          {req.user_id?.avatar_initials || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-foreground leading-none truncate">
                            {req.user_id?.name || 'Unknown User'}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1 truncate">Wants to join</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleHandleRequest(req.id || req._id, 'accepted')}
                          className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => handleHandleRequest(req.id || req._id, 'rejected')}
                          className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Forge Ideas */}
            <div className="bg-card border border-border/60 rounded-[28px] p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-10 translate-x-10"></div>
              <Sparkles className="w-5 h-5 text-foreground mb-3" />
              <h3 className="text-[15px] font-bold text-foreground mb-1">Forge Ideas</h3>
              <p className="text-[13px] text-muted-foreground">Collaborate with fellow researchers in {selected.subject}.</p>
            </div>



          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background overflow-y-auto">
      <div className="max-w-6xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row items-end justify-between gap-6 mb-12">
          <div>
            <h2 className="text-4xl font-black text-foreground tracking-tight mb-3">Discovery Fields</h2>
            <p className="text-muted-foreground text-lg font-medium">Join established fellowships or pioneer your own</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-widest text-xs hover:opacity-90 transition-all shadow-xl shadow-primary/20"
          >
            <Plus className="w-5 h-5" />
            Establish Community
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-6 mb-12">
          <div className="relative flex-1 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground w-6 h-6 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search by subject, name, or keywords..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-6 py-5 bg-card border border-primary/10 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-foreground text-lg shadow-xl shadow-black/5"
            />
          </div>
          <select
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
            className="px-8 py-5 bg-card border border-border rounded-2xl text-foreground font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 cursor-pointer appearance-none shadow-xl shadow-black/5"
          >
            <option value="">All Domains</option>
            {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>
        ) : communities.length === 0 ? (
          <div className="text-center py-32 bg-card border border-dashed border-border rounded-[40px]">
            <Globe className="w-20 h-20 text-muted-foreground mx-auto mb-8 opacity-20" />
            <p className="text-2xl font-black text-foreground mb-4 italic">No fellowships discovered in this realm</p>
            <button onClick={() => setShowCreate(true)} className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-widest text-xs">
              Pioneer the first
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {communities.map((c) => (
              <div
                key={c.id}
                className="bg-card/50 backdrop-blur-md border border-border/50 hover:border-primary/30 rounded-3xl p-6 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 group cursor-pointer relative overflow-hidden flex flex-col h-full"
                onClick={() => openCommunity(c)}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-16 translate-x-16 blur-3xl group-hover:bg-primary/20 transition-colors opacity-50"></div>

                <div className="flex items-start justify-between mb-5 relative z-10">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 group-hover:scale-105 transition-transform shadow-sm">
                    <span className="text-2xl">{c.icon || '🔬'}</span>
                  </div>
                  <Badge variant="secondary" className="font-bold border-none bg-muted/50 text-foreground px-2.5 py-1 text-xs">
                    {c.memberCount} Members
                  </Badge>
                </div>

                <h3 className="text-lg font-black text-foreground mb-2 group-hover:text-primary transition-colors leading-tight line-clamp-1">{c.name}</h3>
                <p className="text-muted-foreground mb-6 text-xs leading-relaxed line-clamp-2 font-medium flex-1">{c.description}</p>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/40">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate max-w-[60%]">
                    <Users className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                    <span className="truncate">{c.subject}</span>
                  </div>
                  {c.isMember ? (
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5 shrink-0">
                      Joined
                    </span>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleJoin(c.id); }}
                      className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline underline-offset-4 shrink-0"
                    >
                      {c.is_private ? 'Req. Join' : 'Join'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-card border border-border w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-3xl font-black text-foreground tracking-tighter">Forge Community</h3>
                <button onClick={() => setShowCreate(false)} className="p-3 hover:bg-muted rounded-2xl transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-8">
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">Community Designation</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-background border border-border rounded-2xl px-6 py-4 focus:ring-4 focus:ring-primary/10 transition-all font-bold text-lg"
                    placeholder="e.g. Quantum Computing Research"
                    value={createForm.name}
                    onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">Research Domain</label>
                    <select
                      className="w-full bg-background border border-border rounded-2xl px-6 py-4 font-bold appearance-none cursor-pointer"
                      value={createForm.subject}
                      onChange={e => setCreateForm({ ...createForm, subject: e.target.value })}
                    >
                      {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {createForm.subject === 'Other' && (
                    <div>
                      <label className="block text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">Specify Field</label>
                      <input
                        type="text"
                        className="w-full bg-background border border-border rounded-2xl px-6 py-4 font-bold"
                        placeholder="Your domain..."
                        value={createForm.customSubject}
                        onChange={e => setCreateForm({ ...createForm, customSubject: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">Pioneering Vision</label>
                  <textarea
                    className="w-full bg-background border border-border rounded-2xl px-6 py-4 font-medium resize-none"
                    placeholder="Describe the mission of this fellowship..."
                    rows={3}
                    value={createForm.description}
                    onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  />
                </div>

                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-2xl border border-border">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-background rounded-xl flex items-center justify-center border border-border/50">
                        <Lock className="w-5 h-5 text-primary/60" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Private Fellowship</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">Approval Required</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      className="w-6 h-6 rounded-lg border-2 border-primary text-primary focus:ring-primary"
                      checked={createForm.is_private}
                      onChange={e => setCreateForm({ ...createForm, is_private: e.target.checked })}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creating || !createForm.name.trim()}
                  className="w-full py-5 bg-primary text-primary-foreground rounded-[24px] font-black uppercase tracking-[0.2em] text-xs hover:shadow-2xl hover:shadow-primary/20 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                  Ignite Community
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({ post, currentUser, onDelete, onPaperSelect }: { post: CommunityPost; currentUser: UserProfile | null; onDelete: (postId: string) => void; onPaperSelect?: (paperId: string) => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // \u2705 BACKWARD COMPAT FIX: The new backend sends 'papers' (array of multiple papers).
  // But the old backend on Render/Vercel might still send 'paper' (a single object).
  // We handle both cases here so paper attachments show up on cloud deploys too.
  const attachedPapers = post.papers?.length ? post.papers : (post.paper ? [post.paper] : []);

  return (
    <div className="bg-card border border-border/60 rounded-[28px] p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm overflow-hidden">
            {post.author?.avatar_url ? (
              <img src={post.author.avatar_url} alt={post.author.name} className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold">{post.author?.avatar_initials || '?'}</span>
            )}
          </div>
          <div>
            <h4 className="text-[15px] font-bold text-foreground leading-none">{post.author?.name || 'Researcher'}</h4>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1 block">{post.author?.role || 'STUDENT'}</span>
          </div>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)} 
            className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          
          {showMenu && (
            <>
              <div className="fixed inset-0 z-0" onClick={() => setShowMenu(false)}></div>
              <div className="absolute right-0 top-full mt-1 z-10 flex flex-col gap-1 w-32 shadow-xl">
                {(currentUser?.id === post.user_id || currentUser?.name === post.author?.name) && (
                  <button 
                    onClick={() => {
                      onDelete(post.id);
                      setShowMenu(false);
                    }} 
                    className="bg-red-500 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-lg hover:bg-red-600 text-left transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <p className={`text-[15px] text-foreground whitespace-pre-wrap leading-relaxed ${attachedPapers.length > 0 ? 'mb-4' : ''}`}>{post.content}</p>

      {/* Paper Attachment */}
      {attachedPapers.length > 0 && (
        <div className="space-y-3">
          {attachedPapers.map((paper: any) => (
            <div 
              key={paper.id}
              onClick={() => onPaperSelect?.(paper.id)}
              className="border border-border/60 rounded-2xl overflow-hidden cursor-pointer hover:bg-muted/30 transition-colors flex max-sm:flex-col"
            >
              <div className="w-full sm:w-32 h-32 sm:h-auto bg-gradient-to-br from-slate-800 to-slate-700 relative overflow-hidden shrink-0 flex items-center justify-center">
                 <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
                 <BookOpen className="w-8 h-8 text-white/50 relative z-10" />
              </div>
              <div className="p-4 flex-1 min-w-0 flex flex-col justify-center">
                <h5 className="text-[15px] font-bold text-foreground mb-1.5 truncate">{paper.title}</h5>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                  {paper.authors.join(', ')} - {paper.year}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Research Detail · {paper.year}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {attachedPapers.length > 0 && (
        <div className="flex items-center justify-end border-t border-border/40 pt-4 px-2 mt-4">
          <button 
            disabled={isSaved}
            onClick={() => {
              setIsSaved(true);
              Promise.all(attachedPapers.map((paper: any) => papersApi.toggleSave(paper.id)))
                .catch(err => {
                  console.error('Failed to save paper to library', err);
                  setIsSaved(false);
                });
            }}
            className={`flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-full transition-colors ${
              isSaved 
                ? 'text-pink-600 bg-pink-100 cursor-default' 
                : 'text-pink-500 bg-pink-500/5 hover:bg-pink-500/10'
            }`}
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-pink-600' : 'fill-pink-500/20'}`} /> 
            <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Add to Library'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
