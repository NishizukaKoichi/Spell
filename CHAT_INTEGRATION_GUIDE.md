# Chat Backend Integration - Implementation Guide

This document describes the complete chat backend integration that has been implemented.

## Overview

A complete chat system with:
- Message storage and retrieval
- AI response generation (mock implementation, ready for real AI integration)
- Conversation management
- Real-time streaming support
- Rate limiting and security
- Audit logging
- Comprehensive API endpoints

## Database Schema

### ChatConversation Model
```prisma
model ChatConversation {
  id            String        @id @default(cuid())
  userId        String
  title         String?
  lastMessageAt DateTime      @default(now())
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages      ChatMessage[]

  @@index([userId])
  @@index([lastMessageAt])
  @@index([userId, lastMessageAt])
  @@map("chat_conversations")
}
```

### ChatMessage Model
```prisma
model ChatMessage {
  id             String            @id @default(cuid())
  conversationId String?
  userId         String
  content        String
  role           String            # 'user', 'assistant', 'system'
  metadata       Json?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  user           User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversation   ChatConversation? @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([conversationId])
  @@index([createdAt])
  @@index([userId, createdAt])
  @@index([conversationId, createdAt])
  @@map("chat_messages")
}
```

## API Endpoints

### 1. Messages Endpoint (`/api/chat/messages`)

#### GET - Retrieve Message History
```typescript
GET /api/chat/messages?conversationId={id}&limit=50&offset=0
```

**Response:**
```json
{
  "messages": [
    {
      "id": "msg_123",
      "userId": "user_123",
      "conversationId": "conv_123",
      "content": "Hello!",
      "role": "user",
      "metadata": null,
      "createdAt": "2025-11-06T12:00:00.000Z",
      "updatedAt": "2025-11-06T12:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

#### POST - Send Message and Get AI Response
```typescript
POST /api/chat/messages
Content-Type: application/json

{
  "content": "Hello, how are you?",
  "conversationId": "conv_123", // optional
  "metadata": {} // optional
}
```

**Response:**
```json
{
  "userMessage": {
    "id": "msg_user",
    "content": "Hello, how are you?",
    "role": "user",
    "createdAt": "2025-11-06T12:00:00.000Z"
  },
  "assistantMessage": {
    "id": "msg_assistant",
    "content": "I'm doing well, thank you!",
    "role": "assistant",
    "createdAt": "2025-11-06T12:00:01.000Z"
  }
}
```

**Rate Limits:**
- Authenticated users: 100 requests/minute
- Returns 429 Too Many Requests if exceeded

### 2. Conversations Endpoint (`/api/chat/conversations`)

#### GET - List Conversations
```typescript
GET /api/chat/conversations?limit=20&offset=0
```

**Response:**
```json
{
  "conversations": [
    {
      "id": "conv_123",
      "userId": "user_123",
      "title": "Chat about spells",
      "lastMessageAt": "2025-11-06T12:00:00.000Z",
      "createdAt": "2025-11-06T10:00:00.000Z",
      "updatedAt": "2025-11-06T12:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

#### POST - Create Conversation
```typescript
POST /api/chat/conversations
Content-Type: application/json

{
  "title": "My new conversation" // optional
}
```

#### DELETE - Delete Conversation
```typescript
DELETE /api/chat/conversations?id=conv_123
```

#### PATCH - Update Conversation Title
```typescript
PATCH /api/chat/conversations
Content-Type: application/json

{
  "conversationId": "conv_123",
  "title": "Updated title"
}
```

### 3. Streaming Endpoint (`/api/chat/stream`)

#### POST - Stream AI Responses
```typescript
POST /api/chat/stream
Content-Type: application/json

{
  "content": "Tell me a story",
  "conversationId": "conv_123", // optional
  "metadata": {} // optional
}
```

**Response:** Server-Sent Events (SSE)
```
data: {"type":"start","userMessage":{...}}

data: {"type":"chunk","content":"Once "}

data: {"type":"chunk","content":"upon "}

data: {"type":"chunk","content":"a "}

data: {"type":"chunk","content":"time..."}

data: {"type":"end","assistantMessage":{...}}
```

## Library Functions

### Core Functions (`/src/lib/chat.ts`)

#### Message Processing
```typescript
// Validate message content
validateMessageContent(content: string): { valid: boolean; error?: string }

// Sanitize message to prevent XSS
sanitizeMessage(content: string): string

// Store a message
storeMessage(params: {
  userId: string;
  content: string;
  role: ChatRole;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<ChatMessage>

// Get message history
getMessageHistory(params: {
  userId: string;
  conversationId?: string | null;
  limit?: number;
  offset?: number;
}): Promise<ChatMessage[]>
```

#### Conversation Management
```typescript
// Create conversation
createConversation(params: {
  userId: string;
  title?: string;
}): Promise<ChatConversation>

// Get user's conversations
getUserConversations(params: {
  userId: string;
  limit?: number;
  offset?: number;
}): Promise<ChatConversation[]>

// Delete conversation
deleteConversation(params: {
  conversationId: string;
  userId: string;
}): Promise<void>

// Update conversation title
updateConversationTitle(params: {
  conversationId: string;
  userId: string;
  title: string;
}): Promise<ChatConversation>
```

#### AI Integration
```typescript
// Process user message and prepare context
processUserMessage(params: {
  userId: string;
  content: string;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{
  userMessage: ChatMessage;
  context: Array<{ role: string; content: string }>;
}>

// Generate AI response (mock - replace with real AI)
generateAIResponse(params: {
  context: Array<{ role: string; content: string }>;
  userId: string;
}): Promise<string>

// Handle complete chat interaction
handleChatMessage(params: {
  userId: string;
  content: string;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}>

// Stream AI responses
generateStreamingAIResponse(params: {
  context: Array<{ role: string; content: string }>;
  userId: string;
}): AsyncGenerator<string, void, unknown>
```

## Frontend Integration

### React Hook (`/src/hooks/use-chat.ts`)

```typescript
import { useChat } from '@/hooks/use-chat';

function ChatComponent() {
  const {
    messages,      // Array of messages
    isLoading,     // Loading state
    error,         // Error message
    sendMessage,   // Function to send message
    loadHistory,   // Function to reload history
    clearMessages, // Function to clear messages
  } = useChat({
    conversationId: 'conv_123', // optional
    onSuccess: (userMsg, aiMsg) => {
      console.log('Message sent successfully');
    },
    onError: (error) => {
      console.error('Error:', error);
    },
  });

  return (
    <div>
      {/* Render messages */}
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}

      {/* Send message */}
      <button onClick={() => sendMessage('Hello!')}>
        Send
      </button>
    </div>
  );
}
```

### Message List Component (`/src/components/chat-message-list.tsx`)

```typescript
import { ChatMessageList } from '@/components/chat-message-list';

<ChatMessageList
  messages={messages}
  isLoading={isLoading}
  error={error}
/>
```

### Simple Chat Example (`/src/app/chat/simple-chat-example.tsx`)

A complete working example is available at `/src/app/chat/simple-chat-example.tsx`.

## Security Features

### 1. Input Validation
- Message content length limits (1-10,000 characters)
- XSS prevention through sanitization
- Request body validation

### 2. Rate Limiting
- 100 requests/minute for authenticated users
- Sliding window algorithm for accurate limiting
- Configurable per endpoint

### 3. Authentication
- All endpoints require authentication via NextAuth
- User ownership validation for conversations
- Session-based access control

### 4. Audit Logging
All chat actions are logged:
- `CHAT_MESSAGE_SENT` - When a message is sent
- `CHAT_CONVERSATION_CREATED` - When a conversation is created
- `CHAT_CONVERSATION_DELETED` - When a conversation is deleted

Logs include:
- User ID
- Resource ID
- IP address
- User agent
- Timestamp
- Metadata

## AI Integration

### Current Implementation (Mock)

The current implementation uses a simple mock AI that responds based on keywords. This is located in `/src/lib/chat.ts`:

```typescript
export async function generateAIResponse(params: {
  context: Array<{ role: string; content: string }>;
  userId: string;
}): Promise<string> {
  // TODO: Replace with actual AI service integration
  // Mock implementation here...
}
```

### Integrating Real AI

#### Option A: OpenAI API

1. Install the OpenAI SDK:
```bash
pnpm add openai
```

2. Add API key to `.env`:
```bash
OPENAI_API_KEY=sk-...
```

3. Update `generateAIResponse`:
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateAIResponse(params: {
  context: Array<{ role: string; content: string }>;
  userId: string;
}): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: params.context as any,
    temperature: 0.7,
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
}
```

#### Option B: Anthropic Claude API

1. Install the Anthropic SDK:
```bash
pnpm add @anthropic-ai/sdk
```

2. Add API key to `.env`:
```bash
ANTHROPIC_API_KEY=sk-ant-...
```

3. Update `generateAIResponse`:
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateAIResponse(params: {
  context: Array<{ role: string; content: string }>;
  userId: string;
}): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 1024,
    messages: params.context,
  });

  return response.content[0].type === 'text'
    ? response.content[0].text
    : 'Sorry, I could not generate a response.';
}
```

## Database Migration

To apply the database migration:

```bash
# Generate Prisma client
npx prisma generate

# Apply migration
npx prisma migrate deploy

# Or for development
npx prisma migrate dev
```

## Testing

### Run Tests
```bash
pnpm test
```

### Test Coverage
Tests are located in `/tests/lib/chat.test.ts` and cover:
- Message validation
- Message sanitization
- Message storage
- Conversation management
- AI response generation
- Context management

## Configuration

### Message Limits
Adjust in `/src/lib/chat.ts`:
```typescript
export const MESSAGE_VALIDATION = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 10000,
  MAX_CONTEXT_MESSAGES: 50,
  MAX_CONTEXT_TOKENS: 4000,
} as const;
```

### Rate Limits
Adjust in `/src/lib/rate-limit.ts`:
```typescript
export const RATE_LIMIT_TIERS: Record<RateLimitTier, number> = {
  [RateLimitTier.AUTHENTICATED]: 100, // Change this
  // ...
};
```

## Troubleshooting

### Messages Not Saving
1. Check database connection
2. Verify migration was applied
3. Check console for errors

### AI Responses Not Working
1. Verify API keys are set correctly
2. Check rate limits on AI service
3. Review error logs in console

### Rate Limiting Issues
1. Clear rate limit storage (in-memory resets on restart)
2. Adjust rate limits if needed
3. Check authentication status

## Next Steps

1. **Replace Mock AI**: Integrate with a real AI service (OpenAI, Anthropic, etc.)
2. **Add Streaming UI**: Implement progressive display of streaming responses
3. **Conversation Management UI**: Add UI for listing/switching conversations
4. **Message History Pagination**: Add infinite scroll for older messages
5. **Rich Message Types**: Support markdown, code blocks, images
6. **User Preferences**: Allow users to customize AI behavior
7. **Export Conversations**: Add ability to export chat history

## Additional Resources

- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Anthropic Claude API Documentation](https://docs.anthropic.com/claude/reference)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Prisma Documentation](https://www.prisma.io/docs)
