# Class Diagram — Research Hub

This diagram covers the full architecture: **MongoDB Models**, **Backend Controllers/Routes**, **Frontend Components**, and **Services**.

---

## Part 1 — Data Models (MongoDB / Mongoose)

```mermaid
classDiagram
    direction TB

    class User {
        +String id
        +String name
        +String email
        +String password
        +String role
        +String avatar_initials
        +String avatar_url
        +String[] interests
        +Boolean hasSelectedInterests
        +Date created_at
        +Date updated_at
    }

    class Paper {
        +String id
        +String title
        +String[] authors
        +String year
        +Number citations
        +String[] tags
        +String abstract
        +String pdf_url
        +String source_url
        +String doi
        +String external_id
        +Date created_at
        +Date updated_at
    }

    class Project {
        +String id
        +String user_id
        +String name
        +String description
        +String color
        +String[] papers
        +Date created_at
        +Date updated_at
    }

    class SavedPaper {
        +String id
        +String user_id
        +String paper_id
        +Date saved_at
    }

    class ReadingProgress {
        +String id
        +String user_id
        +String paper_id
        +Number progress
        +Date last_read_at
    }

    class Conversation {
        +String id
        +String user_id
        +String title
        +Date created_at
        +Date updated_at
    }

    class Message {
        +String id
        +String conversation_id
        +String role
        +String content
        +Date created_at
        +Date updated_at
    }

    class Upload {
        +String id
        +String user_id
        +String filename
        +String original_name
        +String mime_type
        +Number size_bytes
        +String paper_id
        +Date created_at
        +Date updated_at
    }

    class Community {
        +String id
        +String name
        +String description
        +String subject
        +String icon
        +String created_by
        +Boolean is_private
        +Boolean allow_invites
        +Date created_at
        +Date updated_at
    }

    class CommunityMember {
        +String id
        +String community_id
        +String user_id
        +String role
        +Date joined_at
    }

    class JoinRequest {
        +String id
        +String community_id
        +String user_id
        +String status
        +Date created_at
        +Date updated_at
    }

    class CommunityPost {
        +String id
        +String community_id
        +String user_id
        +String content
        +String paper_id
        +Number likes
        +Date created_at
        +Date updated_at
    }

    %% ── Relationships ────────────────────────────────
    User "1" --> "0..*" Project       : owns
    User "1" --> "0..*" SavedPaper    : saves
    User "1" --> "0..*" ReadingProgress : tracks
    User "1" --> "0..*" Conversation  : has
    User "1" --> "0..*" Upload        : uploads
    User "1" --> "0..*" Community     : creates
    User "1" --> "0..*" CommunityMember : joins
    User "1" --> "0..*" JoinRequest   : requests
    User "1" --> "0..*" CommunityPost : posts

    Paper "1" --> "0..*" SavedPaper      : saved via
    Paper "1" --> "0..*" ReadingProgress : tracked via
    Paper "0..1" --> "0..*" Upload       : attached to
    Paper "0..1" --> "0..*" CommunityPost : shared in

    Project "1" --> "0..*" Paper          : contains

    Conversation "1" --> "0..*" Message   : contains

    Community "1" --> "0..*" CommunityMember : has
    Community "1" --> "0..*" JoinRequest     : receives
    Community "1" --> "0..*" CommunityPost   : hosts
```

---

## Part 2 — Backend Controllers & Routes

```mermaid
classDiagram
    direction LR

    class AuthController {
        +register(req, res) Promise
        +login(req, res) Promise
        +googleLogin(req, res) Promise
        +forgotPassword(req, res) Promise
        +getMe(req, res) Promise
    }

    class UserController {
        +getUserProfile(req, res) Promise
        +updateUserProfile(req, res) Promise
        +uploadAvatar(req, res) Promise
        +addPassword(req, res) Promise
        +deleteAccount(req, res) Promise
    }

    class PapersController {
        +getSavedPapers(req, res) Promise
        +savePaper(req, res) Promise
        +unsavePaper(req, res) Promise
        +getPaperById(req, res) Promise
        +getReadingProgress(req, res) Promise
        +updateReadingProgress(req, res) Promise
    }

    class SearchController {
        +searchPapers(req, res) Promise
        +getPersonalizedFeed(req, res) Promise
    }

    class ProjectsController {
        +getProjects(req, res) Promise
        +createProject(req, res) Promise
        +getProjectById(req, res) Promise
        +updateProject(req, res) Promise
        +deleteProject(req, res) Promise
        +addPaperToProject(req, res) Promise
        +removePaperFromProject(req, res) Promise
    }

    class CommunityController {
        +getCommunities(req, res) Promise
        +createCommunity(req, res) Promise
        +joinCommunity(req, res) Promise
        +requestJoin(req, res) Promise
        +leaveCommunity(req, res) Promise
        +getCommunityPosts(req, res) Promise
        +createPost(req, res) Promise
        +likePost(req, res) Promise
        +getJoinRequests(req, res) Promise
        +handleJoinRequest(req, res) Promise
    }

    class ChatController {
        +getConversations(req, res) Promise
        +createConversation(req, res) Promise
        +getMessages(req, res) Promise
        +deleteConversation(req, res) Promise
    }

    class AIController {
        +chat(req, res) Promise
    }

    class UploadController {
        +uploadFile(req, res) Promise
        +getUploads(req, res) Promise
    }

    class StatsController {
        +getStats(req, res) Promise
    }

    class AuthMiddleware {
        +authMiddleware(req, res, next) void
        -verifyJWT(token) DecodedToken
    }

    class FirebaseAdmin {
        +verifyIdToken(idToken) DecodedToken
    }

    AuthController ..> FirebaseAdmin   : uses (Google login)
    AuthController ..> AuthMiddleware  : used by route
    UserController ..> AuthMiddleware  : protected by
    PapersController ..> AuthMiddleware : protected by
    SearchController ..> AuthMiddleware : protected by
    ProjectsController ..> AuthMiddleware : protected by
    CommunityController ..> AuthMiddleware : protected by
    ChatController ..> AuthMiddleware  : protected by
    AIController ..> AuthMiddleware    : protected by
    UploadController ..> AuthMiddleware : protected by
```

---

## Part 3 — Frontend Components

```mermaid
classDiagram
    direction TB

    class App {
        -String activeTab
        -Boolean isChatOpen
        -String selectedPaper
        -Boolean isAuthenticated
        -Object user
        +render() JSX
        -fetchUserProfile() void
        -handleLogin(token, user) void
    }

    class AuthScreen {
        -String mode
        -String email
        -String password
        -String name
        -Boolean loading
        -String error
        +handleEmailLogin() void
        +handleRegister() void
        +handleGoogleSignIn() void
        +render() JSX
    }

    class InterestsModal {
        -String[] selectedInterests
        -Boolean loading
        +handleToggleInterest(interest) void
        +handleSubmit() void
        +render() JSX
    }

    class LeftSidebar {
        -String activeTab
        +onTabChange(tab) void
        +render() JSX
    }

    class CenterFeed {
        -String activeTab
        -Paper[] savedPapers
        -Project[] projects
        -Boolean loading
        +onPaperSelect(id) void
        +render() JSX
    }

    class DiscoverView {
        -String query
        -Paper[] results
        -Boolean loading
        -String error
        +handleSearch() void
        +render() JSX
    }

    class ForYouView {
        -Paper[] papers
        -Boolean loading
        -String[] userInterests
        +fetchPersonalizedFeed() void
        +onGoToSettings() void
        +render() JSX
    }

    class ResearchPaperCard {
        -Paper paper
        -Boolean isSaved
        +onSelect(id) void
        +onSave(id) void
        +render() JSX
    }

    class PaperDetailModal {
        -String paperId
        -Paper paper
        -Number readingProgress
        -Boolean isSaved
        +onClose() void
        +handleSave() void
        +handleProgressUpdate() void
        +render() JSX
    }

    class AIChatSidebar {
        -Boolean isOpen
        -Conversation[] conversations
        -Message[] messages
        -String activeConversation
        -String inputText
        -Boolean loading
        +onClose() void
        +handleSendMessage() void
        +handleUploadPDF() void
        +handleNewConversation() void
        +handleDeleteConversation() void
        +render() JSX
    }

    class CommunityView {
        -Community[] communities
        -String activeView
        -String selectedCommunity
        -CommunityPost[] posts
        +onPaperSelect(id) void
        +handleJoin(id) void
        +handleCreatePost() void
        +handleLikePost(id) void
        +render() JSX
    }

    class ProjectDetailView {
        -Project project
        -Paper[] papers
        +onBack() void
        +handleRemovePaper(id) void
        +render() JSX
    }

    class CreateProjectModal {
        -String name
        -String description
        -String color
        -Boolean loading
        +onClose() void
        +handleSubmit() void
        +render() JSX
    }

    class SettingsView {
        -Object user
        -String theme
        -Boolean loading
        +handleUpdateProfile() void
        +handleChangePassword() void
        +handleDeleteAccount() void
        +handleToggleTheme() void
        +render() JSX
    }

    class BrandLogo {
        +render() JSX
    }

    %% ── Component Relationships ──────────────────────
    App "1" *-- "1" AuthScreen        : shows if not auth
    App "1" *-- "1" InterestsModal    : shows if no interests
    App "1" *-- "1" LeftSidebar       : always renders
    App "1" *-- "1" CenterFeed        : tab: library/projects
    App "1" *-- "1" DiscoverView      : tab: discover
    App "1" *-- "1" ForYouView        : tab: foryou
    App "1" *-- "1" CommunityView     : tab: community
    App "1" *-- "1" SettingsView      : tab: settings
    App "1" *-- "1" AIChatSidebar     : always rendered
    App "1" *-- "1" PaperDetailModal  : shown on paper click

    CenterFeed "1" *-- "0..*" ResearchPaperCard  : renders
    CenterFeed "1" *-- "0..*" ProjectDetailView  : renders
    CenterFeed "1" *-- "1"   CreateProjectModal  : renders

    DiscoverView "1" *-- "0..*" ResearchPaperCard : renders
    ForYouView "1" *-- "0..*" ResearchPaperCard   : renders
    CommunityView "1" *-- "0..*" ResearchPaperCard : renders

    LeftSidebar "1" ..> BrandLogo : renders
```

---

## Part 4 — API Services (Frontend ↔ Backend)

```mermaid
classDiagram
    direction LR

    class ApiClient {
        -String baseURL
        -AxiosInstance instance
        +get(url, config) Promise
        +post(url, data, config) Promise
        +put(url, data, config) Promise
        +patch(url, data, config) Promise
        +delete(url, config) Promise
        -attachAuthInterceptor() void
    }

    class AuthApi {
        +register(name, email, password) Promise
        +login(email, password) Promise
        +googleLogin(idToken) Promise
        +forgotPassword(email) Promise
        +getMe() Promise
    }

    class UserApi {
        +getProfile() Promise
        +updateProfile(data) Promise
        +uploadAvatar(formData) Promise
        +addPassword(password) Promise
        +deleteAccount() Promise
    }

    class PapersApi {
        +getSavedPapers() Promise
        +savePaper(paperId) Promise
        +unsavePaper(paperId) Promise
        +getPaperById(id) Promise
        +getReadingProgress(paperId) Promise
        +updateReadingProgress(paperId, progress) Promise
    }

    class SearchApi {
        +searchPapers(query) Promise
        +getPersonalizedFeed(interests) Promise
    }

    class ProjectsApi {
        +getProjects() Promise
        +createProject(data) Promise
        +updateProject(id, data) Promise
        +deleteProject(id) Promise
        +addPaper(projectId, paperId) Promise
        +removePaper(projectId, paperId) Promise
    }

    class CommunityApi {
        +getCommunities() Promise
        +createCommunity(data) Promise
        +joinCommunity(id) Promise
        +requestJoin(id) Promise
        +getPosts(communityId) Promise
        +createPost(communityId, data) Promise
        +likePost(postId) Promise
        +getJoinRequests(communityId) Promise
        +handleJoinRequest(communityId, requestId, action) Promise
    }

    class ChatApi {
        +getConversations() Promise
        +createConversation(title) Promise
        +getMessages(conversationId) Promise
        +sendMessage(conversationId, message, context) Promise
        +deleteConversation(id) Promise
    }

    class UploadApi {
        +uploadFile(formData) Promise
        +getUploads() Promise
    }

    class StatsApi {
        +getStats() Promise
    }

    ApiClient <|-- AuthApi
    ApiClient <|-- UserApi
    ApiClient <|-- PapersApi
    ApiClient <|-- SearchApi
    ApiClient <|-- ProjectsApi
    ApiClient <|-- CommunityApi
    ApiClient <|-- ChatApi
    ApiClient <|-- UploadApi
    ApiClient <|-- StatsApi
```
