import { useState, useEffect } from 'react';
import { LeftSidebar } from './components/LeftSidebar';
import { CenterFeed } from './components/CenterFeed';
import { AIChatSidebar } from './components/AIChatSidebar';
import { SettingsView } from './components/SettingsView';
import { PaperDetailModal } from './components/PaperDetailModal';
import { CommunityView } from './components/CommunityView';
import { DiscoverView } from './components/DiscoverView';
import { ForYouView } from './components/ForYouView';
import { MessageSquare } from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { ThemeProvider } from './context/ThemeContext';
import { userApi } from './services/api';
import { InterestsModal } from './components/InterestsModal';
import { LandingPage } from './components/LandingPage';
import { GuestFeatureLock } from './components/GuestFeatureLock';
import { AboutPage } from './components/AboutPage';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('guest') ? 'discover' : 'library';
  });
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [user, setUser] = useState<any>(null);
  
  const [isGuest, setIsGuest] = useState(!!localStorage.getItem('guest'));
  const [showLanding, setShowLanding] = useState(!localStorage.getItem('token') && !localStorage.getItem('guest'));
  const [showAuth, setShowAuth] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    // Check if we have a valid session on load
    const token = localStorage.getItem('token');
    if (token) {
      userApi.getProfile()
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('token');
          setIsAuthenticated(false);
        });
    }
  }, []);

  useEffect(() => {
    const handleSwitchTab = () => {
      setActiveTab('discover');
    };
    window.addEventListener('openDiscoverTab', handleSwitchTab);
    return () => window.removeEventListener('openDiscoverTab', handleSwitchTab);
  }, []);

  if (showAbout) {
    return <AboutPage onBack={() => setShowAbout(false)} />;
  }

  if (showLanding) {
    return (
      <LandingPage
        onGetStarted={() => {
          setShowLanding(false);
          setShowAuth(true);
        }}
        onGuestAccess={() => {
          localStorage.setItem('guest', 'true');
          setIsGuest(true);
          setShowLanding(false);
          setActiveTab('discover'); // Force discover tab for guests
        }}
        onAboutClick={() => setShowAbout(true)}
      />
    );
  }

  if (showAuth || (!isAuthenticated && !isGuest)) {
    return (
      <AuthScreen
        customTitle={isGuest ? "Want to access this feature??" : undefined}
        customSubtitle={isGuest ? "Create an account to continue." : undefined}
        defaultIsLogin={!isGuest}
        onLogin={(token, user) => {
          localStorage.setItem('token', token);
          localStorage.removeItem('guest');
          setUser(user);
          setIsAuthenticated(true);
          setIsGuest(false);
          setShowAuth(false);
        }}
        onCancel={isGuest ? () => {
          setShowAuth(false);
          setActiveTab('discover');
        } : undefined}
      />
    );
  }

  const renderMain = () => {
    switch (activeTab) {
      case 'settings':  return <SettingsView />;
      case 'community': return <CommunityView onPaperSelect={setSelectedPaper} />;
      // 'foryou' and 'discover' are always mounted below — not rendered here
      default: return <CenterFeed activeTab={activeTab} onPaperSelect={setSelectedPaper} />;
    }
  };

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar activeTab={activeTab} onTabChange={setActiveTab} isGuest={isGuest} />

        {/* Center Content — switch-rendered tabs */}
        {!['foryou', 'discover'].includes(activeTab) && !isGuest && renderMain()}

        {/* Guest Lock Screen */}
        {isGuest && activeTab !== 'discover' && (
          <div className="flex-1 overflow-hidden flex">
            <GuestFeatureLock onSignUp={() => setShowAuth(true)} />
          </div>
        )}

        {/* Always-mounted views — preserved across tab switches so search state survives */}
        <div className={`flex-1 overflow-hidden ${(activeTab === 'foryou' && !isGuest) ? 'flex' : 'hidden'}`}>
          <ForYouView
            userInterests={user?.interests || []}
            onGoToSettings={() => setActiveTab('settings')}
          />
        </div>
        <div className={`flex-1 overflow-hidden ${activeTab === 'discover' ? 'flex' : 'hidden'}`}>
          <DiscoverView />
        </div>

        {/* AI Chat Sidebar */}
        {!isGuest && <AIChatSidebar isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />}

        {/* Paper Detail Modal */}
        <PaperDetailModal
          paperId={selectedPaper}
          onClose={() => setSelectedPaper(null)}
        />

        {/* Floating Chat Toggle */}
        {!isGuest && !isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-xl hover:opacity-90 transition-all flex items-center justify-center group hover:scale-110"
          >
            <MessageSquare className="w-6 h-6" />
            <span className="absolute right-full mr-3 px-3 py-2 bg-popover text-popover-foreground border text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-md">
              Open AI Assistant
            </span>
          </button>
        )}

        {/* Interests Modal */}
        {user && !user.hasSelectedInterests && (
          <InterestsModal 
            onComplete={(interests) => {
              setUser({ ...user, interests, hasSelectedInterests: true });
            }}
          />
        )}
      </div>
    </ThemeProvider>
  );
}
