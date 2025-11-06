# Multi-Passkey Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Profile Page                         │
│                  (src/app/profile/page.tsx)                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     PasskeyList Component                   │
│               (src/components/passkey-list.tsx)             │
│                                                             │
│  • Fetches passkeys from API                                │
│  • Manages state (loading, refreshing)                      │
│  • Handles add/delete operations                            │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│   PasskeyCard Component   │   │ AddPasskeyDialog Component│
│  (passkey-card.tsx)       │   │ (add-passkey-dialog.tsx)  │
│                           │   │                           │
│  • Display passkey info   │   │  • Name input             │
│  • Show timestamps        │   │  • WebAuthn flow          │
│  • Delete functionality   │   │  • Error handling         │
└─────────────┬─────────────┘   └────────────┬──────────────┘
              │                              │
              └──────────────┬───────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                         API Layer                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  GET    /api/passkeys           → List all passkeys        │
│  DELETE /api/passkeys           → Delete passkey           │
│  POST   /api/passkeys/add-options    → Generate options   │
│  POST   /api/passkeys/add-verify     → Verify & save      │
│                                                             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                           │
│                  (PostgreSQL + Prisma)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  authenticators table:                                      │
│    • credentialID (PK)                                      │
│    • userId (FK → users)                                    │
│    • credentialPublicKey                                    │
│    • counter                                                │
│    • name (NEW)                                             │
│    • createdAt (NEW)                                        │
│    • lastUsedAt (NEW)                                       │
│    • credentialDeviceType                                   │
│    • credentialBackedUp                                     │
│    • transports                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Authentication Flow

### Initial Registration (Signup)

```
User (Browser)          Frontend            API Server          Database
     │                     │                     │                  │
     │─── Enter Email ────>│                     │                  │
     │                     │                     │                  │
     │                     │─ POST /register-options ─>│            │
     │                     │                     │                  │
     │                     │                     │── Check user ──>│
     │                     │                     │<── User data ───│
     │                     │                     │                  │
     │                     │<─── Challenge ──────│                  │
     │                     │                     │                  │
     │<─ WebAuthn Prompt ──│                     │                  │
     │                     │                     │                  │
     │─ Biometric Auth ───>│                     │                  │
     │                     │                     │                  │
     │                     │─ POST /register-verify ─>│             │
     │                     │                     │                  │
     │                     │                     │── Create user ─>│
     │                     │                     │── Save passkey ─>│
     │                     │                     │<── Confirmed ───│
     │                     │                     │                  │
     │                     │<─── Session ────────│                  │
     │<─── Logged In ──────│                     │                  │
```

### Adding New Passkey

```
User (Browser)          Frontend            API Server          Database
     │                     │                     │                  │
     │─ Click "Add" ──────>│                     │                  │
     │                     │                     │                  │
     │─ Enter Name ───────>│                     │                  │
     │                     │                     │                  │
     │                     │─ POST /add-options ──>│                │
     │                     │   (with session)    │                  │
     │                     │                     │                  │
     │                     │                     │─ Verify session ─>│
     │                     │                     │<─ User data ─────│
     │                     │                     │                  │
     │                     │<─── Challenge ──────│                  │
     │                     │                     │                  │
     │<─ WebAuthn Prompt ──│                     │                  │
     │                     │                     │                  │
     │─ Biometric Auth ───>│                     │                  │
     │                     │                     │                  │
     │                     │─ POST /add-verify ───>│                │
     │                     │   (with session)    │                  │
     │                     │                     │                  │
     │                     │                     │─ Verify session ─>│
     │                     │                     │─ Save passkey ──>│
     │                     │                     │<─ Confirmed ─────│
     │                     │                     │                  │
     │                     │<─── Success ────────│                  │
     │<─ List Updated ─────│                     │                  │
```

### Using Passkey for Login

```
User (Browser)          Frontend            API Server          Database
     │                     │                     │                  │
     │─── Enter Email ────>│                     │                  │
     │                     │                     │                  │
     │                     │─ POST /auth-options ──>│               │
     │                     │                     │                  │
     │                     │                     │── Get passkeys ─>│
     │                     │                     │<── Passkeys ────│
     │                     │                     │                  │
     │                     │<─── Challenge ──────│                  │
     │                     │                     │                  │
     │<─ WebAuthn Prompt ──│                     │                  │
     │                     │                     │                  │
     │─ Biometric Auth ───>│                     │                  │
     │                     │                     │                  │
     │                     │─ POST /auth-verify ──>│                │
     │                     │                     │                  │
     │                     │                     │── Verify auth ──>│
     │                     │                     │── Update usage ─>│
     │                     │                     │   (lastUsedAt)   │
     │                     │                     │<── Confirmed ───│
     │                     │                     │                  │
     │                     │<─── Session ────────│                  │
     │<─── Logged In ──────│                     │                  │
```

## Component Hierarchy

```
ProfilePage
│
├── DashboardLayout
│   │
│   └── User Info Card
│       └── Stats Display
│
├── Passkeys Card
│   │
│   └── PasskeyList (Client Component)
│       │
│       ├── Loading State
│       │   └── Skeleton Loaders
│       │
│       ├── Empty State
│       │   └── "No passkeys" message
│       │
│       ├── PasskeyCard (for each passkey)
│       │   ├── Device Icon
│       │   ├── Passkey Info
│       │   │   ├── Name/ID
│       │   │   ├── Credential ID
│       │   │   └── Badges (type, backup, usage)
│       │   ├── Timestamps
│       │   │   ├── Created date
│       │   │   └── Last used date
│       │   └── Delete Button
│       │       └── AlertDialog
│       │           ├── Confirmation
│       │           └── Delete Action
│       │
│       └── Add Passkey Button
│           └── AddPasskeyDialog
│               ├── Name Input
│               ├── Info Panel
│               └── Action Buttons
│
├── Published Spells Card
│   └── Spell List
│
├── Recent Casts Card
│   └── Cast List
│
└── API Keys Section
    └── ApiKeys Component
```

## Data Flow

### State Management

```
┌─────────────────────────────────────┐
│      PasskeyList Component          │
├─────────────────────────────────────┤
│                                     │
│  State:                             │
│  • passkeys: Passkey[]             │
│  • loading: boolean                │
│  • refreshing: boolean             │
│                                     │
│  Effects:                           │
│  • useEffect(() => fetchPasskeys()) │
│                                     │
│  Handlers:                          │
│  • handleRefresh()                 │
│  • handleDelete(credentialID)      │
│  • handlePasskeyAdded()            │
│                                     │
└─────────────────────────────────────┘
```

### API Request/Response Patterns

#### List Passkeys
```typescript
Request:  GET /api/passkeys
          Headers: { Cookie: session }

Response: {
  passkeys: [
    {
      credentialID: string,
      name: string | null,
      createdAt: Date,
      lastUsedAt: Date | null,
      ...
    }
  ]
}
```

#### Add Passkey
```typescript
Step 1 - Get Options:
  Request:  POST /api/passkeys/add-options
            Body: { name?: string }
            Headers: { Cookie: session }

  Response: { options: PublicKeyCredentialCreationOptions }

Step 2 - Verify:
  Request:  POST /api/passkeys/add-verify
            Body: { response: RegistrationResponseJSON }
            Headers: { Cookie: session }

  Response: { success: true, message: string }
```

#### Delete Passkey
```typescript
Request:  DELETE /api/passkeys
          Body: { credentialID: string }
          Headers: { Cookie: session }

Response: { success: true, message: string }

Error:    { error: string }
          (e.g., "Cannot delete your last passkey")
```

## Security Considerations

### Authorization Checks

```
Every API endpoint:
1. Verify session exists
2. Extract user ID from session
3. Verify resource ownership
4. Execute operation
5. Return result
```

### Cookie Security

```
All sensitive data stored in HTTP-only cookies:
• webauthn-challenge (short-lived, 5 min)
• webauthn-reg-name (short-lived, 5 min)
• authjs.session-token (long-lived, 30 days)

Properties:
• httpOnly: true
• secure: true (production)
• sameSite: 'lax'
• path: '/'
```

### Validation Layers

```
Frontend:
  • Input validation
  • User feedback
  • Disabled states

API:
  • Session validation
  • Ownership verification
  • Business logic checks

Database:
  • Unique constraints
  • Foreign key constraints
  • Default values
```

## Performance Optimizations

1. **Client-side fetching**: Passkeys fetched on-demand, not server-side
2. **Optimistic updates**: UI updates before server confirmation
3. **Loading states**: Skeleton loaders for better UX
4. **Debouncing**: Prevent rapid successive API calls
5. **Indexing**: Database indexes on userId for fast queries

## Error Handling

```
Component Level:
  • try/catch blocks
  • Toast notifications (sonner)
  • Error state management
  • Graceful degradation

API Level:
  • HTTP status codes
  • Error messages
  • Validation errors
  • Server errors

Database Level:
  • Transaction rollbacks
  • Constraint violations
  • Connection errors
```
