import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Plus, X, Globe, MessageSquare, BookOpen, Loader2,
  LogIn, LogOut, Heart, Trash2, Send, ChevronLeft, Sparkles, Lock
} from 'lucide-react';
import { Badge } from './ui/badge';
import { communityApi, papersApi, type Community, type CommunityPost, type Paper } from '../services/api';

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
  const [attachedPaperId, setAttachedPaperId] = useState<string | null>(null);
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
  const [creating, setCreating] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);

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
    papersApi.getAll().then(r => setLocalPapers(r.data)).catch(() => {});
  }, []);

  const openCommunity = async (community: Community) => {
    setSelected(community);
    try {
      const res = await communityApi.getById(community.id);
      setSelected(res.data);
      if (res.data.is_private) {
        communityApi.getJoinRequests(community.id).then(r => setRequests(r.data)).catch(() => {});
      }
    } catch (err) {
      console.error(err);
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
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); }
  };

  const handlePost = async () => {
    if (!postInput.trim() || !selected) return;
    setSending(true);
    try {
      const res = await communityApi.createPost(selected.id, postInput.trim(), attachedPaperId || undefined);
      setSelected(prev => prev ? { ...prev, posts: [res.data, ...(prev.posts || [])], postCount: prev.postCount + 1 } : prev);
      setPostInput('');
      setAttachedPaperId(null);
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
      setRequests(prev => prev.filter(r => r.id !== requestId));
      if (status === 'accepted' && selected) {
        setSelected({ ...selected, memberCount: selected.memberCount + 1 });
      }
    } catch (err) { console.error(err); }
  };

  if (selected) {
    return (
      <div className="flex-1 bg-background overflow-hidden flex flex-col h-full animate-in fade-in duration-500">
        <div className="p-8 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-6 group">
            <button 
              onClick={() => setSelected(null)}
              className="p-4 hover:bg-background border border-transparent hover:border-border rounded-2xl transition-all group-hover:-translate-x-1"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-3xl font-black text-foreground tracking-tighter">{selected.name}</h2>
                {selected.is_private && <Badge variant="outline" className="text-[10px] font-black tracking-widest uppercase py-0.5 border-primary/20 text-primary bg-primary/5">Private Fellowship</Badge>}
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {selected.memberCount} researchers</span>
                <span className="w-1 h-1 bg-muted rounded-full"></span>
                <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Domain: {selected.subject}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => selected.isMember ? handleLeave(selected.id) : handleJoin(selected.id)}
              disabled={actionLoading === selected.id}
              className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl ${
                selected.isMember
                  ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-none'
                  : 'bg-primary text-primary-foreground hover:opacity-90 shadow-primary/20'
              }`}
            >
              {actionLoading === selected.id ? <Loader2 className="w-5 h-5 animate-spin" /> : selected.isMember ? <><LogOut className="w-5 h-5" /> Leave Field</> : <><LogIn className="w-5 h-5" /> Join Discovery</>}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-12">
            {/* Membership Petitions */}
            {selected.is_private && requests.length > 0 && (
              <div className="bg-primary/5 border border-primary/10 rounded-3xl p-8 animate-in slide-in-from-top-4 duration-500 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Users className="w-24 h-24 text-primary" />
                </div>
                <h3 className="text-xl font-black text-foreground uppercase tracking-widest mb-8 flex items-center gap-3">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                  Membership Petitions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {requests.map(req => (
                    <div key={req.id} className="bg-background border border-border p-6 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg overflow-hidden">
                          {req.user_id?.avatar_url ? (
                            <img src={req.user_id.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white font-black">{req.user_id?.avatar_initials || '?'}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{req.user_id?.name || 'Researcher'}</p>
                          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-0.5">Awaiting Review</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                         <button
                          onClick={() => handleHandleRequest(req.id, 'accepted')}
                          className="p-2.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleHandleRequest(req.id, 'rejected')}
                          className="p-2.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              {/* Feed */}
              <div className="lg:col-span-2 space-y-8">
                {/* Post Composer */}
                {selected.isMember ? (
                  <div className="bg-card border border-border rounded-3xl p-8 shadow-xl shadow-black/5 relative group transition-all focus-within:ring-4 focus-within:ring-primary/5">
                    <div className="flex items-center gap-3 mb-6">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Share an Insight</span>
                    </div>
                    <textarea
                      value={postInput}
                      onChange={e => setPostInput(e.target.value)}
                      placeholder="What breakthroughs are you working on today?"
                      className="w-full bg-transparent border-none focus:ring-0 text-xl font-medium placeholder-muted-foreground resize-none min-h-[140px]"
                    />

                    {/* Attached Paper */}
                    {attachedPaperId && (
                      <div className="mb-6 flex items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-2xl animate-in fade-in slide-in-from-left-2">
                        <div className="w-10 h-10 bg-background rounded-xl flex items-center justify-center border border-primary/20">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-sm font-bold text-foreground flex-1 truncate">
                          {localPapers.find(p => p.id === attachedPaperId)?.title || 'Selected Research'}
                        </span>
                        <button onClick={() => setAttachedPaperId(null)} className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-all">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-8 border-t border-border/50">
                      <button
                        onClick={() => setShowPaperPicker(v => !v)}
                        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all px-4 py-2 hover:bg-primary/5 rounded-xl"
                      >
                        <Plus className="w-4 h-4" /> Connect Paper
                      </button>
                      <button
                        onClick={handlePost}
                        disabled={!postInput.trim() || sending}
                        className="flex items-center gap-3 px-8 py-3.5 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-2xl hover:shadow-primary/20 transition-all disabled:opacity-50"
                      >
                        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        {sending ? 'Publishing...' : 'Publish Insight'}
                      </button>
                    </div>

                    {/* Paper Picker dropdown */}
                    {showPaperPicker && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-4 bg-card border border-border rounded-3xl shadow-2xl max-h-72 overflow-y-auto animate-in zoom-in-95 slide-in-from-top-2">
                        {localPapers.map(p => (
                          <button
                            key={p.id}
                            onClick={() => { setAttachedPaperId(p.id); setShowPaperPicker(false); }}
                            className="w-full text-left p-5 hover:bg-primary/5 border-b border-border/50 last:border-0 transition-colors group"
                          >
                            <span className="font-bold text-foreground group-hover:text-primary transition-colors block mb-1 line-clamp-1">{p.title}</span>
                            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{p.authors[0]} · {p.year}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-primary/5 border border-primary/20 rounded-3xl p-10 text-center animate-in fade-in duration-500">
                    <Lock className="w-12 h-12 text-primary mx-auto mb-6 opacity-30" />
                    <h4 className="text-xl font-black text-foreground mb-3">Community Locked</h4>
                    <p className="text-muted-foreground font-medium mb-8">Join the fellowship to reveal discussions and share your research insights with this community.</p>
                    <button 
                      onClick={() => handleJoin(selected.id)}
                      className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-widest text-xs hover:opacity-90 transition-all shadow-xl shadow-primary/20"
                    >
                      Join Fellowship
                    </button>
                  </div>
                )}

                {/* Posts Feed */}
                <div className="space-y-8">
                  {(selected.posts || []).length === 0 ? (
                    <div className="text-center py-24 text-muted-foreground bg-muted/20 border border-dashed border-border rounded-3xl">
                      <MessageSquare className="w-16 h-16 mx-auto mb-6 opacity-10" />
                      <p className="text-xl font-bold italic tracking-tight">The silent halls of research await your insight...</p>
                    </div>
                  ) : (
                    (selected.posts || []).map(post => (
                      <PostCard key={post.id} post={post} onDelete={handleDeletePost} onPaperSelect={onPaperSelect} />
                    ))
                  )}
                </div>
              </div>

              {/* Members Sidebar */}
              <div className="space-y-8">
                <div className="bg-card border border-border rounded-[32px] p-8 shadow-xl shadow-black/5">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-8 flex items-center justify-between">
                    Fellowship
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full">{selected.memberCount}</span>
                  </h3>
                  <div className="space-y-6">
                    {(selected.members || []).map(m => (
                      <div key={m.id} className="flex items-center gap-4 group/member">
                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center border border-border group-hover/member:bg-primary/10 group-hover/member:border-primary/20 transition-all overflow-hidden shadow-sm">
                          {m.avatar_url ? (
                            <img src={m.avatar_url} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-primary font-black text-sm">{m.avatar_initials}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-foreground truncate group-hover/member:text-primary transition-colors">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-0.5">{m.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-primary/10 to-blue-500/10 border border-primary/10 rounded-[32px] p-8">
                   <Sparkles className="w-10 h-10 text-primary mb-6" />
                   <h4 className="text-xl font-black text-foreground mb-3 leading-tight">Forge Ideas</h4>
                   <p className="text-sm text-muted-foreground font-medium leading-relaxed">Collaborate with fellow researchers in {selected.subject}.</p>
                </div>
              </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {communities.map((c) => (
              <div 
                key={c.id} 
                className="bg-card border border-primary/10 rounded-3xl p-8 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group cursor-pointer relative overflow-hidden"
                onClick={() => openCommunity(c)}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16 blur-3xl group-hover:bg-primary/10 transition-colors"></div>
                
                <div className="flex items-start justify-between mb-8 relative z-10">
                  <div className="w-16 h-16 bg-muted rounded-3xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    <span className="text-3xl">{c.icon || '🔬'}</span>
                  </div>
                  <Badge variant="secondary" className="font-bold border-none bg-primary/10 text-primary px-3 py-1">
                    {c.memberCount} Members
                  </Badge>
                </div>

                <h3 className="text-2xl font-black text-foreground mb-3 group-hover:text-primary transition-colors leading-tight">{c.name}</h3>
                <p className="text-muted-foreground mb-8 text-sm leading-relaxed line-clamp-2 font-medium">{c.description}</p>
                
                <div className="flex items-center justify-between mt-auto pt-6 border-t border-border">
                  <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    <Users className="w-4 h-4 text-primary/40" />
                    {c.subject}
                  </div>
                  {c.isMember ? (
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                       Joined Fellowship
                    </span>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleJoin(c.id); }}
                      className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline underline-offset-4"
                    >
                      {c.is_private ? 'Req. Fellowship' : 'Join discovery'}
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

function PostCard({ post, onDelete, onPaperSelect }: { post: CommunityPost; onDelete: (postId: string) => void; onPaperSelect?: (paperId: string) => void }) {
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="bg-card border border-primary/10 rounded-3xl p-8 hover:shadow-xl transition-all group">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden">
          {post.author?.avatar_url ? (
            <img src={post.author.avatar_url} alt={post.author.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-base font-black">{post.author?.avatar_initials || '?'}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-black text-sm text-foreground mb-0.5 block">{post.author?.name || 'Researcher'}</span>
              <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{post.author?.role}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{timeAgo(post.created_at)}</span>
              <button
                onClick={() => onDelete(post.id)}
                className="p-2 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="text-base text-foreground font-medium leading-relaxed whitespace-pre-wrap mb-8">{post.content}</p>

      {post.paper && (
        <div 
          onClick={() => onPaperSelect?.(post.paper!.id)}
          className="bg-muted/30 border border-border rounded-3xl p-6 mb-8 hover:bg-muted/50 transition-all cursor-pointer relative overflow-hidden group/paper"
        >
          <div className="flex items-center gap-3 mb-3">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Connected Research</span>
          </div>
          <h5 className="text-base font-black text-foreground mb-1 group-hover/paper:text-primary transition-colors">{post.paper.title}</h5>
          <p className="text-xs text-muted-foreground font-medium">
            {post.paper.authors.slice(0, 2).join(', ')} · {post.paper.year}
          </p>
        </div>
      )}

      <div className="flex items-center gap-8 pt-6 border-t border-border/50">
        <button className="flex items-center gap-2.5 text-[10px] font-black text-muted-foreground hover:text-primary uppercase tracking-widest transition-colors group/stat">
          <div className="p-2 bg-muted rounded-lg group-hover/stat:bg-primary/10 transition-all">
            <MessageSquare className="w-4 h-4" />
          </div>
          Discussions
        </button>
        <button className="flex items-center gap-2.5 text-[10px] font-black text-muted-foreground hover:text-pink-500 uppercase tracking-widest transition-colors group/stat">
          <div className="p-2 bg-muted rounded-lg group-hover/stat:bg-pink-500/10 transition-all">
            <Heart className="w-4 h-4" />
          </div>
          {post.likes} Favorites
        </button>
      </div>
    </div>
  );
}
