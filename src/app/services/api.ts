/// <reference types="vite/client" />
// ─── Abstracts API Service ─────────────────────────────────────────────────
// Centralized API client for all backend communication
// ──────────────────────────────────────────────────────────────────────────────

const VITE_API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://abstracts-researchhub.onrender.com' : '');
export const BASE_URL = VITE_API_URL ? `${VITE_API_URL.replace(/\/$/, '')}/api` : '/api';

if (import.meta.env.DEV) {
  console.log('📡 API Base URL:', BASE_URL);
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  error?: string;
  message?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${endpoint}`;
  const token = localStorage.getItem('token');
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  };

  // Don't set Content-Type for FormData (let browser set multipart boundary)
  if (options.body instanceof FormData) {
    delete (config.headers as Record<string, string>)['Content-Type'];
  }

  const response = await fetch(url, config);
  const json = await response.json();

  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes('/auth/')) {
      const hadToken = !!localStorage.getItem('token');
      localStorage.removeItem('token');
      if (hadToken && !localStorage.getItem('guest')) {
        window.location.reload();
      }
    }
    throw new Error(json.error || `Request failed with status ${response.status}`);
  }

  return json;
}

// ─── Papers ──────────────────────────────────────────────────────────────────

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: string;
  citations: number;
  tags: string[];
  abstract: string;
  pdf_url: string | null;
  source_url: string | null;
  saved?: boolean;
  readingProgress?: number;
  created_at: string;
  updated_at: string;
}

export interface AbstractHighlight {
  id: string;
  user_id: string;
  paper_id: string;
  text: string;
  color: string;
}

export interface PapersQuery {
  search?: string;
  sort?: 'most_cited' | 'most_recent' | 'oldest';
  tag?: string;
  year?: string;
  saved_by?: string;
}

export const papersApi = {
  getAll: (query: PapersQuery = {}) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const qs = params.toString();
    return request<Paper[]>(`/papers${qs ? `?${qs}` : ''}`);
  },

  getById: (id: string) => request<Paper>(`/papers/${id}`),

  create: (paper: Partial<Paper>) =>
    request<Paper>('/papers', { method: 'POST', body: JSON.stringify(paper) }),

  update: (id: string, updates: Partial<Paper>) =>
    request<Paper>(`/papers/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),

  delete: (id: string) =>
    request<void>(`/papers/${id}`, { method: 'DELETE' }),

  toggleSave: (id: string) =>
    request<{ saved: boolean }>(`/papers/${id}/save`, { method: 'POST' }),

  updateProgress: (id: string, progress: number) =>
    request<{ paperId: string; progress: number }>(`/papers/${id}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ progress }),
    }),

  getHighlights: (id: string) =>
    request<AbstractHighlight[]>(`/papers/${id}/highlights`),

  addHighlight: (id: string, text: string, color?: string) =>
    request<AbstractHighlight>(`/papers/${id}/highlights`, {
      method: 'POST',
      body: JSON.stringify({ text, color }),
    }),

  removeHighlight: (id: string, highlightId: string) =>
    request<void>(`/papers/${id}/highlights/${highlightId}`, { method: 'DELETE' }),
};

// ─── Projects ────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  color: string;
  paperCount: number;
  progress: number;
  papers?: Paper[];
  created_at: string;
  updated_at: string;
}

export const projectsApi = {
  getAll: () => request<Project[]>('/projects'),

  getById: (id: string) => request<Project>(`/projects/${id}`),

  create: (project: { name: string; description?: string; color?: string }) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(project) }),

  update: (id: string, updates: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),

  delete: (id: string) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),

  addPaper: (projectId: string, paperId: string) =>
    request<void>(`/projects/${projectId}/papers`, {
      method: 'POST',
      body: JSON.stringify({ paperId }),
    }),

  removePaper: (projectId: string, paperId: string) =>
    request<void>(`/projects/${projectId}/papers/${paperId}`, { method: 'DELETE' }),
};

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  message_count?: number;
  last_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export const chatApi = {
  getConversations: () => request<Conversation[]>('/chat/conversations'),

  getMessages: (conversationId: string) =>
    request<{ conversation: Conversation; messages: ChatMessage[] }>(
      `/chat/conversations/${conversationId}/messages`
    ),

  createConversation: (title?: string) =>
    request<{ conversation: Conversation; messages: ChatMessage[] }>(
      '/chat/conversations',
      { method: 'POST', body: JSON.stringify({ title }) }
    ),

  sendMessage: (conversationId: string, content: string) =>
    request<{ userMessage: ChatMessage; aiMessage: ChatMessage }>(
      `/chat/conversations/${conversationId}/messages`,
      { method: 'POST', body: JSON.stringify({ content }) }
    ),

  deleteConversation: (conversationId: string) =>
    request<void>(`/chat/conversations/${conversationId}`, { method: 'DELETE' }),
};

// ─── User ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_initials: string;
  avatar_url?: string;
  interests?: string[];
  hasSelectedInterests?: boolean;
  stats: {
    savedPapers: number;
    projects: number;
    papersInProgress: number;
  };
  created_at: string;
  updated_at: string;
}

export const userApi = {
  getProfile: () => request<UserProfile>('/user'),

  updateProfile: (updates: Partial<UserProfile>) =>
    request<UserProfile>('/user', { method: 'PUT', body: JSON.stringify(updates) }),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return request<UserProfile>('/user/avatar', {
      method: 'POST',
      body: formData,
    });
  },

  addPassword: (password: string) =>
    request<{ message: string }>('/user/password', { method: 'POST', body: JSON.stringify({ password }) }),

  deleteAccount: () =>
    request<{ message: string }>('/user/account', { method: 'DELETE' }),
};



// ─── Community ───────────────────────────────────────────────────────────────



export interface JoinRequest {
  id: string;
  community_id: string;
  user_id: string | { id: string, name: string, avatar_initials: string };
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  subject: string;
  icon: string;
  created_by: string;
  memberCount: number;
  postCount: number;
  isMember: boolean;
  is_private: boolean;
  allow_invites: boolean;
  // ✅ NEW: these fields are now saved to the database. Previously they were only in local state (lost on refresh).
  cover_photo?: string;     // the cover image set by the admin (base64 or URL)
  link?: string;            // custom link the admin added (e.g. their lab website)
  guidelines_link?: string; // link to community rules document
  members?: { id: string; name: string; avatar_initials: string; avatar_url?: string; role: string; joined_at: string }[];
  posts?: CommunityPost[];
  created_at: string;
  updated_at: string;
}

export interface CommunityPost {
  id: string;
  community_id: string;
  user_id: string;
  content: string;
  // The 'papers' array is the NEW format (multiple attachments).
  // The 'paper' (singular) is the OLD format from older backend deployments (e.g. Render before update).
  // We keep both so that old posts still display their paper attachment correctly.
  papers?: { id: string; title: string; authors: string[]; year: string; citations: number }[];
  paper?: { id: string; title: string; authors: string[]; year: string; citations: number }; // backward compat: old backend returns single paper
  likes: number;
  author?: { name: string; avatar_initials: string; avatar_url?: string; role: string };
  created_at: string;
}

export const communityApi = {
  getAll: (params: { search?: string; subject?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>
    ).toString();
    return request<Community[]>(`/community${qs ? '?' + qs : ''}`);
  },
  getById: (id: string) => request<Community>(`/community/${id}`),
  // ✅ NEW: calls PUT /community/:id to save admin edits (cover photo, link, guidelines) to the database
  update: (id: string, data: { cover_photo?: string; link?: string; guidelines_link?: string }) =>
    request<Community>(`/community/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/community/${id}`, { method: 'DELETE' }),
  create: (data: { name: string; description?: string; subject: string; icon?: string; is_private?: boolean; allow_invites?: boolean }) =>
    request<Community>('/community', { method: 'POST', body: JSON.stringify(data) }),
  join: (id: string) => request<{ message: string; status?: string }>(`/community/${id}/join`, { method: 'POST' }),
  leave: (id: string) => request<void>(`/community/${id}/leave`, { method: 'DELETE' }),
  createPost: (id: string, content: string, paper_ids?: string[]) =>
    request<CommunityPost>(`/community/${id}/posts`, {
      method: 'POST',
      body: JSON.stringify({ 
        content, 
        paper_ids,  // NEW format: array of paper IDs (for updated backend)
        // BACKWARD COMPAT: old backends only understand a single paper_id field.
        // We send the first selected paper as paper_id so it still works on Render/Vercel
        // even if they haven't deployed the new backend yet.
        paper_id: paper_ids && paper_ids.length > 0 ? paper_ids[0] : undefined
      }),
    }),
  deletePost: (communityId: string, postId: string) =>
    request<void>(`/community/${communityId}/posts/${postId}`, { method: 'DELETE' }),
  getJoinRequests: (id: string) => request<JoinRequest[]>(`/community/${id}/requests`),
  handleJoinRequest: (requestId: string, status: 'accepted' | 'rejected') =>
    request<void>(`/community/requests/${requestId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  updateMemberRole: (communityId: string, userId: string, role: 'admin' | 'member') =>
    request<void>(`/community/${communityId}/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  removeMember: (communityId: string, userId: string) =>
    request<void>(`/community/${communityId}/members/${userId}`, { method: 'DELETE' }),
};

// ─── External Paper Search ────────────────────────────────────────────────────

export interface ExternalPaper {
  externalId: string;
  title: string;
  authors: string[];
  year: string;
  citations: number;
  abstract: string;
  url: string | null;
  pdfUrl: string | null;
  doi: string | null;
  source: string;
}

export const searchApi = {
  searchPapers: (q: string, limit = 10, offset = 0) =>
    request<ExternalPaper[]>(`/search/papers?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`),
  importPaper: (paper: Partial<ExternalPaper>) =>
    request<Paper>('/search/papers/import', { method: 'POST', body: JSON.stringify(paper) }),
};

// ─── AI ────────────────────────────────────────────────────────────────────────

export const aiApi = {
  summarizePDF: (uploadId: string) =>
    request<{ summary: string; title: string }>('/ai/summarize-pdf', {
      method: 'POST',
      body: JSON.stringify({ uploadId }),
    }),

  suggestPapers: (params: { topic?: string; context?: string; count?: number }) =>
    request<{ suggestions: string; queries: string[] }>('/ai/suggest-papers', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};
