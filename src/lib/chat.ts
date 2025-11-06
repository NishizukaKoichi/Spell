import { prisma } from './prisma';

/**
 * Chat message role types
 */
export enum ChatRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

/**
 * Interface for chat message data
 */
export interface ChatMessage {
  id: string;
  conversationId: string | null;
  userId: string;
  content: string;
  role: ChatRole | string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for chat conversation data
 */
export interface ChatConversation {
  id: string;
  userId: string;
  title: string | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Message validation configuration
 */
export const MESSAGE_VALIDATION = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 10000,
  MAX_CONTEXT_MESSAGES: 50,
  MAX_CONTEXT_TOKENS: 4000, // Approximate token limit for context
} as const;

/**
 * Validate message content
 */
export function validateMessageContent(content: string): {
  valid: boolean;
  error?: string;
} {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'Message content cannot be empty' };
  }

  if (content.length < MESSAGE_VALIDATION.MIN_LENGTH) {
    return {
      valid: false,
      error: `Message must be at least ${MESSAGE_VALIDATION.MIN_LENGTH} character(s)`,
    };
  }

  if (content.length > MESSAGE_VALIDATION.MAX_LENGTH) {
    return {
      valid: false,
      error: `Message cannot exceed ${MESSAGE_VALIDATION.MAX_LENGTH} characters`,
    };
  }

  return { valid: true };
}

/**
 * Sanitize message content to prevent XSS
 */
export function sanitizeMessage(content: string): string {
  // Remove any potentially dangerous HTML tags and scripts
  // Basic sanitization - for production, consider using a library like DOMPurify
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Store a chat message in the database
 */
export async function storeMessage(params: {
  userId: string;
  content: string;
  role: ChatRole | string;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<ChatMessage> {
  const { userId, content, role, conversationId = null, metadata } = params;

  // Validate content
  const validation = validateMessageContent(content);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Sanitize content
  const sanitizedContent = sanitizeMessage(content);

  // Store message
  const message = await prisma.chatMessage.create({
    data: {
      userId,
      content: sanitizedContent,
      role,
      conversationId,
      metadata: metadata || null,
    },
  });

  // Update conversation's lastMessageAt if in a conversation
  if (conversationId) {
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });
  }

  return message;
}

/**
 * Get message history for a user or conversation
 */
export async function getMessageHistory(params: {
  userId: string;
  conversationId?: string | null;
  limit?: number;
  offset?: number;
}): Promise<ChatMessage[]> {
  const { userId, conversationId, limit = 50, offset = 0 } = params;

  const where: any = { userId };

  if (conversationId !== undefined) {
    where.conversationId = conversationId;
  }

  const messages = await prisma.chatMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, MESSAGE_VALIDATION.MAX_CONTEXT_MESSAGES),
    skip: offset,
  });

  // Return in chronological order (oldest first)
  return messages.reverse();
}

/**
 * Create a new conversation
 */
export async function createConversation(params: {
  userId: string;
  title?: string;
}): Promise<ChatConversation> {
  const { userId, title } = params;

  const conversation = await prisma.chatConversation.create({
    data: {
      userId,
      title: title || null,
    },
  });

  return conversation;
}

/**
 * Get all conversations for a user
 */
export async function getUserConversations(params: {
  userId: string;
  limit?: number;
  offset?: number;
}): Promise<ChatConversation[]> {
  const { userId, limit = 20, offset = 0 } = params;

  const conversations = await prisma.chatConversation.findMany({
    where: { userId },
    orderBy: { lastMessageAt: 'desc' },
    take: limit,
    skip: offset,
  });

  return conversations;
}

/**
 * Delete a conversation and all its messages
 */
export async function deleteConversation(params: {
  conversationId: string;
  userId: string;
}): Promise<void> {
  const { conversationId, userId } = params;

  // Verify ownership
  const conversation = await prisma.chatConversation.findFirst({
    where: { id: conversationId, userId },
  });

  if (!conversation) {
    throw new Error('Conversation not found or access denied');
  }

  // Delete conversation (messages will be cascade deleted)
  await prisma.chatConversation.delete({
    where: { id: conversationId },
  });
}

/**
 * Process user message and prepare context for AI
 * Returns message history formatted for AI consumption
 */
export async function processUserMessage(params: {
  userId: string;
  content: string;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{
  userMessage: ChatMessage;
  context: Array<{ role: string; content: string }>;
}> {
  const { userId, content, conversationId, metadata } = params;

  // Store user message
  const userMessage = await storeMessage({
    userId,
    content,
    role: ChatRole.USER,
    conversationId,
    metadata,
  });

  // Get conversation history for context
  const history = await getMessageHistory({
    userId,
    conversationId: conversationId || null,
    limit: MESSAGE_VALIDATION.MAX_CONTEXT_MESSAGES,
  });

  // Format for AI (exclude the just-added message to avoid duplication)
  const context = history
    .filter((msg) => msg.id !== userMessage.id)
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

  // Add the current message at the end
  context.push({
    role: userMessage.role,
    content: userMessage.content,
  });

  return { userMessage, context };
}

/**
 * Generate AI response
 * This is a mock implementation - replace with actual AI service integration
 */
export async function generateAIResponse(params: {
  context: Array<{ role: string; content: string }>;
  userId: string;
}): Promise<string> {
  // TODO: Replace with actual AI service integration
  // Options:
  // 1. OpenAI API: https://platform.openai.com/docs/api-reference/chat
  // 2. Anthropic Claude API: https://docs.anthropic.com/claude/reference/messages_post
  // 3. Other AI services

  // Mock response for now
  const userMessage = params.context[params.context.length - 1]?.content || '';

  // Simple mock responses based on keywords
  if (userMessage.toLowerCase().includes('hello') || userMessage.toLowerCase().includes('hi')) {
    return 'Hello! How can I help you today?';
  }

  if (userMessage.toLowerCase().includes('spell')) {
    return 'I can help you with spells! You can browse available spells in the Bazaar, create your own spells, or execute spells. What would you like to do?';
  }

  if (userMessage.toLowerCase().includes('help')) {
    return `I'm here to help! Here are some things I can assist with:

- **Browse Spells**: Discover spells in the Bazaar
- **Execute Spells**: Run spells and see results
- **Create Spells**: Build your own custom spells
- **Manage Account**: View your profile, billing, and settings

What would you like to know more about?`;
  }

  // Default response
  return `I understand you said: "${userMessage}". This is a mock AI response. To enable real AI capabilities, integrate with OpenAI, Anthropic Claude, or another AI service in the \`generateAIResponse\` function.`;
}

/**
 * Process user message and generate AI response
 * This is the main entry point for chat interactions
 */
export async function handleChatMessage(params: {
  userId: string;
  content: string;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}> {
  const { userId, content, conversationId, metadata } = params;

  // Process user message and get context
  const { userMessage, context } = await processUserMessage({
    userId,
    content,
    conversationId,
    metadata,
  });

  // Generate AI response
  const aiResponse = await generateAIResponse({ context, userId });

  // Store AI response
  const assistantMessage = await storeMessage({
    userId,
    content: aiResponse,
    role: ChatRole.ASSISTANT,
    conversationId: conversationId || userMessage.conversationId,
    metadata: {
      generatedAt: new Date().toISOString(),
      contextLength: context.length,
    },
  });

  return { userMessage, assistantMessage };
}

/**
 * Generate streaming AI response
 * Returns an async generator for streaming responses
 */
export async function* generateStreamingAIResponse(params: {
  context: Array<{ role: string; content: string }>;
  userId: string;
}): AsyncGenerator<string, void, unknown> {
  // TODO: Replace with actual streaming AI service integration
  // For OpenAI: https://platform.openai.com/docs/api-reference/chat/create#chat-create-stream
  // For Anthropic: https://docs.anthropic.com/claude/reference/messages-streaming

  // Mock streaming response
  const response = await generateAIResponse(params);
  const words = response.split(' ');

  for (const word of words) {
    yield word + ' ';
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * Auto-generate conversation title based on first message
 */
export function generateConversationTitle(firstMessage: string): string {
  // Take first 50 characters and add ellipsis if needed
  const maxLength = 50;
  const title = firstMessage.trim();

  if (title.length <= maxLength) {
    return title;
  }

  return title.substring(0, maxLength).trim() + '...';
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(params: {
  conversationId: string;
  userId: string;
  title: string;
}): Promise<ChatConversation> {
  const { conversationId, userId, title } = params;

  // Verify ownership
  const conversation = await prisma.chatConversation.findFirst({
    where: { id: conversationId, userId },
  });

  if (!conversation) {
    throw new Error('Conversation not found or access denied');
  }

  // Update title
  const updated = await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { title },
  });

  return updated;
}

/**
 * Get conversation by ID with ownership check
 */
export async function getConversation(params: {
  conversationId: string;
  userId: string;
}): Promise<ChatConversation | null> {
  const { conversationId, userId } = params;

  const conversation = await prisma.chatConversation.findFirst({
    where: { id: conversationId, userId },
  });

  return conversation;
}
