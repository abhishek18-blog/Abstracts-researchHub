import { useState, useEffect } from 'react';
import { User, Mail, GraduationCap, Save, Loader2, Check, BookOpen, FolderOpen, Clock, Camera, Upload } from 'lucide-react';
import { Badge } from './ui/badge';
import { userApi, type UserProfile } from '../services/api';

export function SettingsView() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    avatar_initials: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await userApi.getProfile();
        setUser(response.data);
        setFormData({
          name: response.data.name,
          email: response.data.email,
          role: response.data.role,
          avatar_initials: response.data.avatar_initials,
        });
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await userApi.updateProfile(formData);
      setUser(prev => prev ? { ...prev, ...response.data } : prev);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const response = await userApi.uploadAvatar(file);
      setUser(prev => prev ? { ...prev, avatar_url: response.data.avatar_url } : prev);
    } catch (err) {
      console.error('Failed to upload photo:', err);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-10">
          <h2 className="text-3xl font-black text-foreground tracking-tight">Account Settings</h2>
          <p className="text-muted-foreground mt-2 text-lg">Personalize your research profile and preferences</p>
        </div>

        {/* Profile Card */}
        <div className="bg-card border border-primary/10 rounded-3xl p-8 mb-8 shadow-xl shadow-black/5 overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-32 translate-x-32 blur-3xl"></div>
          
          <div className="flex flex-col md:flex-row items-center gap-8 mb-10 relative z-10 text-center md:text-left">
            <div className="relative group/avatar">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl transition-all group-hover/avatar:scale-105 duration-300 overflow-hidden border-4 border-background relative">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-3xl font-black tracking-tighter">{formData.avatar_initials}</span>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>
              <label 
                className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-2xl cursor-pointer hover:scale-110 active:scale-95 transition-all group/upload"
                title="Upload Photo"
              >
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
                <Camera className="w-5 h-5 group-hover/upload:rotate-12 transition-transform" />
              </label>
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-foreground mb-1">{formData.name}</h3>
              <p className="text-muted-foreground font-medium mb-3">{formData.email}</p>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-none px-4 py-1.5 font-bold uppercase tracking-widest text-[10px]">
                {formData.role}
              </Badge>
            </div>
          </div>

          {/* Stats Row */}
          {user && (
            <div className="grid grid-cols-3 gap-6 mb-10 relative z-10">
              <div className="bg-background border border-blue-500/10 rounded-2xl p-5 text-center hover:border-primary/30 transition-all hover:shadow-lg">
                <BookOpen className="w-6 h-6 text-blue-500 mx-auto mb-3" />
                <p className="text-3xl font-black text-foreground tracking-tighter">{user.stats.savedPapers}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Saved Papers</p>
              </div>
              <div className="bg-background border border-emerald-500/10 rounded-2xl p-5 text-center hover:border-emerald-500/30 transition-all hover:shadow-lg">
                <FolderOpen className="w-6 h-6 text-emerald-500 mx-auto mb-3" />
                <p className="text-3xl font-black text-foreground tracking-tighter">{user.stats.projects}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Active Projects</p>
              </div>
              <div className="bg-background border border-orange-500/10 rounded-2xl p-5 text-center hover:border-orange-500/30 transition-all hover:shadow-lg">
                <Clock className="w-6 h-6 text-orange-500 mx-auto mb-3" />
                <p className="text-3xl font-black text-foreground tracking-tighter">{user.stats.papersInProgress}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Reading Now</p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-6 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">
                  <User className="w-3.5 h-3.5 text-primary" /> Display Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-5 py-4 bg-background border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-foreground font-medium transition-all"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">
                  <Mail className="w-3.5 h-3.5 text-primary" /> Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-5 py-4 bg-background border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-foreground font-medium transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">
                  <GraduationCap className="w-3.5 h-3.5 text-primary" /> Academic Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-5 py-4 bg-background border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-foreground font-medium cursor-pointer transition-all appearance-none"
                >
                  <option>Student</option>
                  <option>Researcher</option>
                  <option>Professor</option>
                  <option>PhD Candidate</option>
                  <option>Postdoc</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">
                  Initials
                </label>
                <input
                  type="text"
                  value={formData.avatar_initials}
                  onChange={(e) => setFormData({ ...formData, avatar_initials: e.target.value.toUpperCase().slice(0, 2) })}
                  maxLength={2}
                  className="w-28 px-5 py-4 bg-background border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-foreground text-center text-xl font-black uppercase transition-all"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-12 flex items-center justify-end gap-5 pt-8 border-t border-border">
            {saved && (
              <span className="flex items-center gap-2 text-sm font-bold text-emerald-500 animate-in fade-in slide-in-from-right-2">
                <Check className="w-5 h-5" /> All changes synced
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? 'Syncing...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
