import { BookOpen, FolderOpen, BookmarkCheck, Settings, Globe, Users, Loader2, LogOut, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { userApi, type UserProfile } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { BrandLogo } from './BrandLogo';

interface LeftSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function LeftSidebar({ activeTab, onTabChange }: LeftSidebarProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    userApi.getProfile()
      .then(r => setUser(r.data))
      .catch(err => console.error('Failed to fetch user:', err));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.reload();
  };

  const navItems = [
    { id: 'library', label: 'Library', icon: BookOpen },
    { id: 'projects', label: 'Projects', icon: FolderOpen },
    { id: 'saved', label: 'Saved Papers', icon: BookmarkCheck, badge: user?.stats?.savedPapers },
    { id: 'discover', label: 'Discover', icon: Globe },
    { id: 'community', label: 'Community', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-64 bg-sidebar h-screen border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-semibold flex justify-between items-center">
          <BrandLogo />
        </h1>
        <p className="text-muted-foreground text-sm mt-1">AI-Powered Discovery</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon, badge }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${isActive
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 shadow-sm" />
                <span className="text-sm font-medium">{label}</span>
              </div>
              {badge !== undefined && badge > 0 && (
                <span className="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded-full font-bold">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-4 space-y-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sidebar-foreground border border-sidebar-border hover:bg-sidebar-accent transition-all group"
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium">Dark Mode</span>
            </>
          ) : (
            <>
              <Sun className="w-5 h-5 text-yellow-500" />
              <span className="text-sm font-medium">Light Mode</span>
            </>
          )}
        </button>

        {/* User profile */}
        <div className="pt-4 border-t border-sidebar-border">
          <div className="flex items-center justify-between px-2 py-2 rounded-xl hover:bg-sidebar-accent transition-colors group">
            <div
              className="flex items-center gap-3 cursor-pointer flex-1"
              onClick={() => onTabChange('settings')}
            >
              {user ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-sm">{user.avatar_initials}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sidebar-foreground text-sm font-bold truncate">{user.name}</p>
                    <p className="text-muted-foreground text-xs">{user.role}</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                  <span className="text-muted-foreground text-sm">Loading...</span>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
