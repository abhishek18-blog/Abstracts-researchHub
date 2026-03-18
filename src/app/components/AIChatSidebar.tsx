import { useState, useEffect, useRef } from 'react';
import { Send, Upload, X, ChevronLeft, Sparkles, Copy, ThumbsUp, ThumbsDown, Plus, Trash2, MessageSquare, Loader2, Check, BookOpen } from 'lucide-react';
import { Badge } from './ui/badge';
import { chatApi, uploadsApi, aiApi, type Conversation, type ChatMessage } from '../services/api';

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIChatSidebar({ isOpen, onClose }: AIChatSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showConversationList, setShowConversationList] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations on mount
  useEffect(() => {
    if (isOpen) {
      fetchConversations();
    }
  }, [isOpen]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async (skipAutoSelect = false) => {
    try {
      const response = await chatApi.getConversations();
      setConversations(response.data);
      // Auto-select first conversation if none selected AND not skipped
      if (!skipAutoSelect && !activeConversationId && response.data.length > 0) {
        loadConversation(response.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      setLoading(true);
      setActiveConversationId(conversationId);
      setShowConversationList(false);
      const response = await chatApi.getMessages(conversationId);
      setMessages(response.data.messages);
    } catch (err) {
      console.error('Failed to load conversation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNewConversation = async () => {
    try {
      setLoading(true);
      const response = await chatApi.createConversation();
      setActiveConversationId(response.data.conversation.id);
      setMessages(response.data.messages);
      setShowConversationList(false);
      fetchConversations(true); // refresh list, skip auto-select
    } catch (err) {
      console.error('Failed to create conversation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await chatApi.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || sending) return;

    const content = inputValue.trim();
    setInputValue('');
    setSending(true);

    try {
      let currentConvId = activeConversationId;
      
      // If no active conversation, create one first
      if (!currentConvId) {
        const response = await chatApi.createConversation();
        currentConvId = response.data.conversation.id;
        setActiveConversationId(currentConvId);
        setMessages(response.data.messages);
        fetchConversations(); // refresh list in background
      }

      // Optimistic: add user message immediately
      const tempUserMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: currentConvId,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempUserMsg]);

      const response = await chatApi.sendMessage(currentConvId, content);
      
      // Replace temp message with real one and add AI response
      setMessages(prev => [
        ...prev.filter(m => !m.id.startsWith('temp-')),
        response.data.userMessage,
        response.data.aiMessage,
      ]);
      fetchConversations(true); // refresh last_message, skip auto-select
    } catch (err) {
      console.error('Failed to send message:', err);
      // If we failed and had a temp message, remove it
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
    } finally {
      setSending(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInputValue(question);
  };

  const handleCopyMessage = (messageId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSummarizePDF = async (uploadId: string, fileName: string) => {
    setSending(true);
    try {
      // Optimistic: add message about summarization starting
      const tempUserMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: activeConversationId || 'pending',
        role: 'user',
        content: `Please summarize the PDF: "${fileName}"`,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempUserMsg]);

      const response = await aiApi.summarizePDF(uploadId);
      
      // If we didn't have a conversation, we should probably have created one by now
      // but if not, let's just show the response
      setMessages(prev => [
        ...prev.filter(m => !m.id.startsWith('temp-')),
        {
          id: `user-${Date.now()}`,
          conversation_id: activeConversationId || '',
          role: 'user',
          content: `Please summarize the PDF: "${fileName}"`,
          created_at: new Date().toISOString(),
        },
        {
          id: `ai-${Date.now()}`,
          conversation_id: activeConversationId || '',
          role: 'assistant',
          content: response.data.summary,
          created_at: new Date().toISOString(),
        }
      ]);
      
      // Add to database if we have a conversation
      if (activeConversationId) {
        await chatApi.sendMessage(activeConversationId, `Please summarize the PDF: "${fileName}"`);
        // Note: The above is a bit redundant if we want the exact response from Groq,
        // but it keeps the history. For now, let's just keep the local UI state.
      }
    } catch (err) {
      console.error('Summarization failed:', err);
      setMessages(prev => [
        ...prev.filter(m => !m.id.startsWith('temp-')),
        {
          id: `err-${Date.now()}`,
          conversation_id: activeConversationId || '',
          role: 'assistant',
          content: "I'm sorry, I failed to summarize that PDF. Please ensure it's a valid text-based PDF.",
          created_at: new Date().toISOString(),
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSuggestPapers = async () => {
    if (sending) return;
    
    // Use last message as context if available, or just ask generally
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content;
    const topic = lastUserMsg || "latest trends in AI and Research Platforms";

    setSending(true);
    try {
      const tempUserMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: activeConversationId || 'pending',
        role: 'user',
        content: `Give me some research paper suggestions regarding "${topic}"`,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempUserMsg]);

      const response = await aiApi.suggestPapers({ topic });
      
      setMessages(prev => [
        ...prev.filter(m => !m.id.startsWith('temp-')),
        {
          id: `user-${Date.now()}`,
          conversation_id: activeConversationId || '',
          role: 'user',
          content: `Give me some research paper suggestions regarding "${topic}"`,
          created_at: new Date().toISOString(),
        },
        {
          id: `ai-${Date.now()}`,
          conversation_id: activeConversationId || '',
          role: 'assistant',
          content: response.data.suggestions,
          created_at: new Date().toISOString(),
        }
      ]);
    } catch (err) {
      console.error('Suggestions failed:', err);
    } finally {
      setSending(false);
    }
  };

  const handleUploadPDF = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        setLoading(true);
        const response = await uploadsApi.upload(file);
        // After upload, trigger summarization
        handleSummarizePDF(response.data.id, file.name);
      } catch (err) {
        console.error('Upload failed:', err);
      } finally {
        setLoading(false);
      }
    };
    input.click();
  };

  if (!isOpen) return null;

  // Conversation list view
  if (showConversationList) {
    return (
      <div className="w-96 bg-card border-l border-border h-screen flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="px-6 py-6 border-b border-border/50 flex items-center justify-between bg-background/50 backdrop-blur-xl sticky top-0 z-10">
          <div>
            <h3 className="font-bold text-xl text-foreground tracking-tight">Conversations</h3>
            <p className="text-xs text-muted-foreground font-medium">Your research history</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewConversation}
              className="p-2.5 hover:bg-primary/10 text-primary rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95"
              title="New conversation"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowConversationList(false)}
              className="p-2.5 hover:bg-muted text-muted-foreground rounded-xl transition-all active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-16 h-16 bg-muted rounded-3xl flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground opacity-40" />
              </div>
              <p className="text-foreground font-bold text-lg mb-1">No chats yet</p>
              <p className="text-muted-foreground text-sm mb-6">Start your first research session with AI</p>
              <button
                onClick={handleNewConversation}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20"
              >
                Start a conversation
              </button>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`group px-5 py-4 rounded-3xl cursor-pointer transition-all duration-300 border relative overflow-hidden ${
                  conv.id === activeConversationId 
                    ? 'bg-primary/5 border-primary/20 shadow-sm' 
                    : 'bg-card border-primary/5 hover:border-primary/20 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-start justify-between gap-3 relative z-10">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${conv.id === activeConversationId ? 'text-primary' : 'text-foreground'}`}>
                      {conv.title}
                    </p>
                    {conv.last_message && (
                      <p className="text-xs text-muted-foreground truncate mt-1.5 font-medium leading-relaxed opacity-80">
                        {conv.last_message}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3" />
                        {conv.message_count} messages
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="p-2 hover:bg-destructive/10 text-destructive rounded-xl opacity-0 group-hover:opacity-100 transition-all active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Chat view
  return (
    <div className="w-[420px] bg-card border-l border-border h-screen flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-500">
      {/* Header */}
      <div className="px-6 py-6 border-b border-border/50 bg-background/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 transform transition-transform hover:scale-105 duration-300">
                <Sparkles className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-card rounded-full shadow-sm"></div>
            </div>
            <div>
              <h3 className="font-extrabold text-foreground tracking-tight">AI Assistant</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-80">Groq LLaMA 3.3</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowConversationList(true)}
              className="p-2.5 hover:bg-muted text-muted-foreground rounded-xl transition-all"
              title="Recent Conversations"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <button
              onClick={handleNewConversation}
              className="p-2.5 hover:bg-muted text-muted-foreground rounded-xl transition-all"
              title="New Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-border/50 mx-1"></div>
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-muted text-muted-foreground rounded-xl transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 custom-scrollbar bg-gradient-to-b from-background/50 to-background/0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
            <div className="relative">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
            </div>
            <p className="text-muted-foreground text-sm font-bold mt-6 tracking-tight uppercase opacity-60">Synchronizing memory...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-muted/50 rounded-[40px] flex items-center justify-center mb-8 relative">
              <Sparkles className="w-10 h-10 text-primary opacity-30" />
              <div className="absolute inset-0 border-2 border-dashed border-primary/20 rounded-[40px] animate-spin-slow"></div>
            </div>
            <h4 className="text-2xl font-black text-foreground mb-3">Hello, Researcher</h4>
            <p className="text-muted-foreground text-sm max-w-[240px] leading-relaxed">
              I'm ready to help you analyze papers, extract data, or brainstorm new methodologies.
            </p>
          </div>
        ) : (
          (() => {
            const seenIds = new Set();
            const uniqueMessages = messages.filter(m => {
              if (seenIds.has(m.id)) return false;
              seenIds.add(m.id);
              return true;
            });
            
            return uniqueMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-[90%]`}>
                  <div
                    className={`rounded-[24px] px-5 py-4 shadow-sm border ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground border-primary/10 rounded-tr-none'
                        : 'bg-card text-foreground border-primary/10 rounded-tl-none font-medium'
                    }`}
                  >
                    <p className="text-[14px] leading-relaxed whitespace-pre-line select-text">
                      {message.content}
                    </p>
                  </div>
                  
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-3 mt-3 px-1">
                      <button
                        onClick={() => handleCopyMessage(message.id, message.content)}
                        className="p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground"
                        title="Copy content"
                      >
                        {copiedId === message.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button className="p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground">
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground">
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter ml-2">Just now</span>
                    </div>
                  )}
                </div>
              </div>
            ));
          })()
        )}
        {sending && (
          <div className="flex justify-start animate-in fade-in duration-300">
            <div className="bg-card border border-primary/10 rounded-[24px] rounded-tl-none px-6 py-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer Actions & Input */}
      <div className="mt-auto bg-background/50 backdrop-blur-xl border-t border-border/50 pb-8 pt-6 px-6 relative z-10 transition-all focus-within:bg-background">
        {/* Quick Actions (PDF Upload & Suggestions) */}
        {!inputValue.trim() && messages.length > 0 && (
          <div className="mb-6 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-px flex-1 bg-border/50"></span>
              <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] px-2 leading-none">Intelligence Hub</span>
              <span className="h-px flex-1 bg-border/50"></span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={handleUploadPDF}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-card border border-primary/10 rounded-2xl hover:border-primary/30 hover:bg-primary/5 transition-all text-foreground group"
              >
                <div className="p-1.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                  <Upload className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <span className="text-xs font-bold tracking-tight">Summarize PDF</span>
              </button>
              <button
                onClick={handleSuggestPapers}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-card border border-primary/10 rounded-2xl hover:border-primary/30 hover:bg-primary/5 transition-all text-foreground group"
              >
                <div className="p-1.5 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                  <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <span className="text-xs font-bold tracking-tight">Suggestions</span>
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 no-scrollbar">
              {['Highlight key findings', 'Explain technical terms', 'Compare results'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestedQuestion(suggestion)}
                  className="px-4 py-2 bg-muted/30 border border-transparent hover:border-primary/10 hover:bg-card text-muted-foreground hover:text-foreground text-[11px] font-bold rounded-xl transition-all whitespace-nowrap"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Field */}
        <div className="relative group/input">
          <div className="absolute inset-0 bg-primary/5 rounded-[28px] blur-sm group-focus-within/input:bg-primary/10 transition-all opacity-0 group-focus-within/input:opacity-100"></div>
          <div className="relative flex items-end gap-3 bg-card border border-primary/10 rounded-[28px] p-2 pr-3 pr-2 transition-all focus-within:border-primary/30 focus-within:shadow-xl focus-within:shadow-primary/5">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Deep dive into your research..."
              className="flex-1 px-5 py-4 bg-transparent border-none focus:ring-0 text-sm font-medium placeholder-muted-foreground/50 resize-none min-h-[56px] max-h-[160px] custom-scrollbar"
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || sending}
              className="mb-1 p-3.5 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-all disabled:opacity-30 disabled:grayscale shadow-lg shadow-primary/20 active:scale-95"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
