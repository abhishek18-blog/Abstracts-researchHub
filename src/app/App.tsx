import { useState, useEffect } from 'react';
import { LeftSidebar } from './components/LeftSidebar';
import { CenterFeed } from './components/CenterFeed';
import { AIChatSidebar } from './components/AIChatSidebar';
import { SettingsView } from './components/SettingsView';
import { PaperDetailModal } from './components/PaperDetailModal';
import { CommunityView } from './components/CommunityView';
import { DiscoverView } from './components/DiscoverView';
import { MessageSquare } from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { ThemeProvider } from './context/ThemeContext';
import { userApi } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('library');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [user, setUser] = useState<any>(null);

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

  if (!isAuthenticated) {
    return (
      <AuthScreen 
        onLogin={(token, user) => {
          localStorage.setItem('token', token);
          setUser(user);
          setIsAuthenticated(true);
        }} 
      />
    );
  }

  const renderMain = () => {
    switch (activeTab) {
      case 'settings':   return <SettingsView />;
      case 'community':  return <CommunityView onPaperSelect={setSelectedPaper} />;
      case 'discover':   return <DiscoverView />;
      default:           return <CenterFeed activeTab={activeTab} onPaperSelect={setSelectedPaper} />;
    }
  };

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Center Content */}
        {renderMain()}

        {/* AI Chat Sidebar */}
        <AIChatSidebar isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

        {/* Paper Detail Modal */}
        <PaperDetailModal
          paperId={selectedPaper}
          onClose={() => setSelectedPaper(null)}
        />

        {/* Floating Chat Toggle */}
        {!isChatOpen && (
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
      </div>
    </ThemeProvider>
  );
}
