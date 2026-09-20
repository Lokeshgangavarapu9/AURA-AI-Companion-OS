# Mission 6.1: Multi-Tenant Cloud Data Architecture & PostgreSQL Migration

## 1. Architectural Overview

AURA AI Companion OS has transitioned from a single-tenant local prototype into an enterprise-grade, multi-tenant AI Companion platform. The platform features strict tenant isolation across all operational engines, durable database persistence, and provider-agnostic authentication.

```
+-----------------------------------------------------------------------------------+
|                                 Client Applications                               |
|        Web Browser (SPA)        |      Desktop / Mobile     |   Future Interfaces |
+-----------------------------------------------------------------------------------+
                                         │  (JWT Bearer Token / ws?token=...)
                                         ▼
+-----------------------------------------------------------------------------------+
|                                   API Gateway                                     |
|           Express API (/api/v1/*)           │       Voice WebSocket Gateway       |
|    - authenticateUser middleware            │       - token query validation      |
|    - Zod DTO schema validation              │       - stream session isolation    |
+-----------------------------------------------------------------------------------+
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
+─────────────────+            +──────────────────+             +──────────────────+
|  Runtime Engine |            |  Cognitive Engine|             | Memory & Empathy |
| - Context       |            | - Prompt assembly|             | - Scoped Facts   |
|   assembler     |            | - Provider Mgr   |             | - Reflections    |
| - Postprocessing|            | - Gemini / Ollama|             | - Relationship   |
+─────────────────+            +──────────────────+             +──────────────────+
        │                                │                                │
        └────────────────────────────────┼────────────────────────────────┘
                                         ▼
+-----------------------------------------------------------------------------------+
|                        Multi-Tenant Storage Repositories                          |
|  - SqliteSessionRepository          - SqliteMemoryRepository                      |
|  - PersistentRelationshipRepository - Prisma Client ORM                           |
+-----------------------------------------------------------------------------------+
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼ (Development)                                 ▼ (Production)
       +──────────────────+                            +──────────────────+
       |   SQLite (dev)   |                            | Cloud PostgreSQL |
       |   file:./dev.db  |                            | Supabase / Neon  |
       +──────────────────+                            +──────────────────+
```

---

## 2. Database Changes & Schema Design

### Prisma Schema (`backend/prisma/schema.prisma`)
The schema enforces tenant isolation via direct or cascaded foreign key constraints to `User`:

1. **`User`**:
   - `id`: UUID primary key.
   - `email`: Unique index for tenant identity.
   - `passwordHash`: Bcrypt/Argon2 hashed password (null for OAuth-only users).
   - `provider`: Identity provider (`local`, `google`, `github`, `apple`).
   - `providerId`: External identity provider account ID.
   - `isVerified`: Email verification flag.
   - `resetToken` & `resetTokenExpiry`: Ephemeral recovery tokens.
   - `lastLoginAt`: Timestamp for session audits.

2. **`UserProfile`**:
   - 1-to-1 relationship with `User` (`userId` unique, cascade delete).
   - Stores user persona: name, age, occupation, college, bio, avatarUrl.

3. **`UserRelationshipState`**:
   - 1-to-1 persistent relationship model replacing in-memory dictionaries.
   - Persistent metrics: `level`, `trustScore`, `affinityScore`, `relationshipHealth`, `interactionDepth`.
   - Serialized state: `signalsJson`, `profileJson`, `boundariesJson`, `milestonesJson`, `eventsJson`, `historyJson`.

4. **`ConversationSession` & `SessionMessage`**:
   - Scoped by `userId` with index `@@index([userId, updatedAt])`.
   - Messages cascade on session deletion.

5. **`MemoryFact` & `Reflection`**:
   - Scoped by `userId` with indexes `@@index([userId, category])` and `@@index([userId, status])`.
   - Ensures memory retrieval algorithms filter strictly by authenticated tenant.

6. **`Settings`**:
   - 1-to-1 scoped settings per user (`userId` unique, cascade delete).

---

## 3. Switching from SQLite to Production Cloud PostgreSQL

The database schema, Prisma migrations, and repositories have zero SQLite-specific assumptions. To switch to PostgreSQL:

### Step 1: Update Environment Variable
In `backend/.env` (or production environment secrets):
```env
# PostgreSQL connection string (e.g., Supabase, Neon, AWS RDS)
DATABASE_URL="postgresql://aura_user:secret_password@db.supabase.co:5432/aura_production?schema=public&sslmode=require"
```

### Step 2: Update Provider in `schema.prisma`
In `backend/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Step 3: Run Cloud Migration
Execute:
```bash
cd backend
npx prisma migrate deploy
# or for new setups:
npx prisma db push
```

### Step 4: Data Migration from Local SQLite to PostgreSQL (Optional)
If migrating existing development data:
```bash
# Export SQLite tables to JSON or CSV:
sqlite3 dev.db .dump > dump.sql

# Or use Prisma seed script:
npm run prisma:seed
```

---

## 4. API Endpoints Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Create a new user account with isolated profile, settings, and relationship state | No |
| `POST` | `/api/v1/auth/login` | Authenticate email/password and receive JWT access token | No |
| `GET` | `/api/v1/auth/me` | Fetch active user claims, scoped profile, settings, and relationship | Bearer JWT |
| `POST` | `/api/v1/auth/forgot-password` | Request password reset token | No |
| `POST` | `/api/v1/auth/reset-password` | Set new password with valid token | No |
| `POST` | `/api/v1/auth/logout` | Invalidate session client-side | Optional |
| `GET` | `/api/v1/chat/history` | List user conversation history | Optional / User Scoped |
| `POST` | `/api/v1/chat` | Send turn message to ConversationManager | Optional / User Scoped |
| `GET` | `/api/v1/sessions` | List active sessions for user | User Scoped |
| `GET` | `/api/v1/memory` | Retrieve isolated user memory facts | User Scoped |
| `GET` | `/api/v1/profile` | Retrieve isolated user profile | User Scoped |
| `GET` | `/api/v1/settings` | Retrieve isolated user settings | User Scoped |
| `WS` | `/ws/voice?token=<jwt>` | Authenticated bidirectional audio streaming | Optional / User Scoped |

---

## 5. Security Architecture

1. **Authentication Token**:
   - HS256 JWT containing `{ userId, email, name, provider }`.
   - Expires in 7 days (`JWT_EXPIRES_IN=7d`).
   - Validated by `authenticateUser` middleware which mounts claims to `req.user`.

2. **Password Security**:
   - `bcryptjs` with 12 salt rounds.
   - Enforces minimum 8 characters.

3. **Tenant Boundary Guarantee**:
   - Repositories automatically query with `where: { userId }`.
   - Backward-compatible fallback gracefully defaults to a single local fallback user when running unauthenticated legacy tests without crashing.

4. **Cross-Device Continuity**:
   - Upon logging in on any browser or device, the user's sessions, memories, relationship scores, and preferences load immediately from the centralized cloud database.
