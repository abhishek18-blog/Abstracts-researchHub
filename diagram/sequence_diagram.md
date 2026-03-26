# Sequence Diagram — Research Hub

Key interaction flows between User (Browser), Frontend (React), Backend (Express), External Services, and Database (MongoDB).

---

## 1. User Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend (React)
    participant BE as Backend (Express)
    participant FB as Firebase Auth
    participant DB as MongoDB

    User->>FE: Open App
    FE->>FE: Check localStorage for JWT token
    alt Token exists
        FE->>BE: GET /api/auth/me (Authorization: Bearer <token>)
        BE->>DB: Find User by ID
        DB-->>BE: User document
        BE-->>FE: 200 OK { user }
        FE->>FE: Set user state, render main app
    else No token
        FE->>FE: Render AuthScreen
        alt Email / Password Login
            User->>FE: Enter email + password → click Login
            FE->>BE: POST /api/auth/login { email, password }
            BE->>DB: Find user by email, verify bcrypt hash
            DB-->>BE: User found
            BE-->>FE: 200 { token, user }
        else Google Sign-In
            User->>FE: Click "Continue with Google"
            FE->>FB: signInWithPopup (Google Provider)
            FB-->>FE: Firebase ID Token
            FE->>BE: POST /api/auth/google { idToken }
            BE->>FB: verifyIdToken(idToken)
            FB-->>BE: Decoded token (email, name)
            BE->>DB: Find or create user
            DB-->>BE: User document
            BE-->>FE: 200 { token, user }
        end
        FE->>FE: Store JWT in localStorage, set user state
    end

    alt No Interests Selected
        FE->>FE: Show InterestsModal
        User->>FE: Select interests → confirm
        FE->>BE: PUT /api/user { interests, hasSelectedInterests: true }
        BE->>DB: Update user document
        DB-->>BE: Updated user
        BE-->>FE: 200 { user }
        FE->>FE: Close modal, load main app
    end
```

---

## 2. Paper Search & Save Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend (React)
    participant BE as Backend (Express)
    participant SemanticScholar as Semantic Scholar API
    participant DB as MongoDB

    User->>FE: Navigate to Discover tab, type search query
    FE->>BE: GET /api/search?q=<query>
    BE->>SemanticScholar: Search papers API call
    SemanticScholar-->>BE: Paper list (title, authors, abstract, DOI)
    BE->>DB: Upsert papers to Paper collection
    DB-->>BE: Saved paper IDs
    BE-->>FE: 200 [ Paper[] ]
    FE->>FE: Render PaperCards

    User->>FE: Click "Save Paper"
    FE->>BE: POST /api/papers/save { paperId }
    BE->>DB: Insert SavedPaper { user_id, paper_id }
    DB-->>BE: Success
    BE-->>FE: 200 { savedPaper }
    FE->>FE: Update UI (paper marked as saved)

    User->>FE: Click paper card → Open PaperDetailModal
    FE->>BE: GET /api/papers/:id
    BE->>DB: Find Paper by ID
    DB-->>BE: Paper document
    BE-->>FE: 200 { paper }
    FE->>FE: Render full paper details
```

---

## 3. AI Chat Flow (with PDF Upload)

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend (React)
    participant BE as Backend (Express)
    participant Gemini as Google Gemini AI
    participant DB as MongoDB

    User->>FE: Open AI Chat Sidebar
    FE->>BE: GET /api/chat/conversations
    BE->>DB: Find conversations by user_id
    DB-->>BE: Conversation list
    BE-->>FE: 200 [ Conversation[] ]
    FE->>FE: Render conversation list

    opt Upload PDF
        User->>FE: Select PDF file → click Upload
        FE->>BE: POST /api/upload (multipart/form-data)
        BE->>BE: Extract text from PDF (multer)
        BE->>DB: Insert Upload document
        DB-->>BE: Upload record
        BE-->>FE: 200 { uploadId, extractedText }
        FE->>FE: Store context for chat session
    end

    User->>FE: Type message → press Send
    FE->>BE: POST /api/ai/chat { conversationId, message, context? }
    BE->>DB: Save user message to Message collection
    DB-->>BE: Saved message
    BE->>Gemini: Generate response with conversation history + context
    Gemini-->>BE: AI response text
    BE->>DB: Save AI response message
    DB-->>BE: Saved message
    BE-->>FE: 200 { reply, citations? }
    FE->>FE: Append AI reply to chat UI
```

---

## 4. Community Interaction Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend (React)
    participant BE as Backend (Express)
    participant DB as MongoDB

    User->>FE: Navigate to Community tab
    FE->>BE: GET /api/community
    BE->>DB: Find all communities + membership status for user
    DB-->>BE: Community list
    BE-->>FE: 200 [ Community[] ]
    FE->>FE: Render community cards

    alt Join Public Community
        User->>FE: Click "Join"
        FE->>BE: POST /api/community/:id/join
        BE->>DB: Insert CommunityMember { community_id, user_id, role: 'member' }
        DB-->>BE: Member record
        BE-->>FE: 200 { member }
        FE->>FE: Update UI (joined state)
    else Request to Join Private Community
        User->>FE: Click "Request Access"
        FE->>BE: POST /api/community/:id/request
        BE->>DB: Insert JoinRequest { community_id, user_id, status: 'pending' }
        DB-->>BE: JoinRequest record
        BE-->>FE: 200 { request }
    end

    User->>FE: Select a community → View posts
    FE->>BE: GET /api/community/:id/posts
    BE->>DB: Find CommunityPosts by community_id
    DB-->>BE: Post list
    BE-->>FE: 200 [ CommunityPost[] ]

    User->>FE: Type post content → click Post
    FE->>BE: POST /api/community/:id/posts { content, paperId? }
    BE->>DB: Insert CommunityPost
    DB-->>BE: New post
    BE-->>FE: 200 { post }
    FE->>FE: Append post to feed

    User->>FE: Click Like on a post
    FE->>BE: PATCH /api/community/posts/:postId/like
    BE->>DB: Increment likes counter
    DB-->>BE: Updated post
    BE-->>FE: 200 { likes }
    FE->>FE: Update like count in UI
```
