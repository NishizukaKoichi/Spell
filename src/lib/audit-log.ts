import { prisma } from './prisma';

/**
 * Comprehensive audit event types for tracking all important platform actions
 */
export enum AuditAction {
  // Authentication events
  AUTH_LOGIN = 'auth.login',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_REGISTER = 'auth.register',
  AUTH_LOGIN_FAILED = 'auth.login_failed',

  // Passkey/WebAuthn events
  PASSKEY_REGISTER = 'passkey.register',
  PASSKEY_VERIFY = 'passkey.verify',
  PASSKEY_REGISTER_FAILED = 'passkey.register_failed',
  PASSKEY_VERIFY_FAILED = 'passkey.verify_failed',

  // Spell management events
  SPELL_CREATED = 'spell.created',
  SPELL_UPDATED = 'spell.updated',
  SPELL_DELETED = 'spell.deleted',
  SPELL_VIEWED = 'spell.viewed',

  // Cast execution events
  CAST_CREATED = 'cast.created',
  CAST_STARTED = 'cast.started',
  CAST_COMPLETED = 'cast.completed',
  CAST_FAILED = 'cast.failed',
  CAST_CANCELLED = 'cast.cancelled',
  CAST_STATUS_CHANGED = 'cast.status_changed',

  // SSE connection events
  SSE_CONNECTION_OPENED = 'cast.sse_connection_opened',
  SSE_CONNECTION_CLOSED = 'cast.sse_connection_closed',
  SSE_CONNECTION_FAILED = 'cast.sse_connection_failed',

  // Payment events
  PAYMENT_CHECKOUT_CREATED = 'payment.checkout_created',
  PAYMENT_SUCCESS = 'payment.success',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_CANCELLED = 'payment.cancelled',

  // API key management events
  API_KEY_CREATED = 'api_key.created',
  API_KEY_REVOKED = 'api_key.revoked',
  API_KEY_USED = 'api_key.used',

  // Budget events
  BUDGET_UPDATED = 'budget.updated',
  BUDGET_RESET = 'budget.reset',
  BUDGET_CAP_EXCEEDED = 'budget.cap_exceeded',

  // Security events
  RATE_LIMIT_EXCEEDED = 'security.rate_limit_exceeded',
  INVALID_SIGNATURE = 'security.invalid_signature',
  UNAUTHORIZED_ACCESS = 'security.unauthorized_access',
  IDEMPOTENCY_CONFLICT = 'security.idempotency_conflict',

  // Review events
  REVIEW_CREATED = 'review.created',
  REVIEW_UPDATED = 'review.updated',
  REVIEW_DELETED = 'review.deleted',

  // Chat events
  CHAT_MESSAGE_SENT = 'chat.message_sent',
  CHAT_CONVERSATION_CREATED = 'chat.conversation_created',
  CHAT_CONVERSATION_DELETED = 'chat.conversation_deleted',

  // Artifact storage events
  ARTIFACT_UPLOADED = 'artifact.uploaded',
  ARTIFACT_DOWNLOADED = 'artifact.downloaded',
  ARTIFACT_DELETED = 'artifact.deleted',
  ARTIFACT_ACCESS_DENIED = 'artifact.access_denied',

  // WASM events
  WASM_MODULE_UPLOADED = 'wasm.module_uploaded',
  WASM_MODULE_VALIDATED = 'wasm.module_validated',
  WASM_MODULE_VALIDATION_FAILED = 'wasm.module_validation_failed',
  WASM_EXECUTION_STARTED = 'wasm.execution_started',
  WASM_EXECUTION_COMPLETED = 'wasm.execution_completed',
  WASM_EXECUTION_FAILED = 'wasm.execution_failed',
  WASM_EXECUTION_TIMEOUT = 'wasm.execution_timeout',
  WASM_MEMORY_LIMIT_EXCEEDED = 'wasm.memory_limit_exceeded',
}

/**
 * Resource types for audit logs
 */
export enum AuditResource {
  USER = 'user',
  SPELL = 'spell',
  CAST = 'cast',
  API_KEY = 'api_key',
  PAYMENT = 'payment',
  BUDGET = 'budget',
  REVIEW = 'review',
  SESSION = 'session',
  PASSKEY = 'passkey',
  ARTIFACT = 'artifact',
  CHAT_MESSAGE = 'chat_message',
  CHAT_CONVERSATION = 'chat_conversation',
  WASM_MODULE = 'wasm_module',
  WASM_EXECUTION = 'wasm_execution',
}

/**
 * Status types for audit log entries
 */
export enum AuditStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PENDING = 'pending',
}

/**
 * Interface for creating audit log entries
 */
export interface CreateAuditLogParams {
  userId?: string | null;
  action: AuditAction | string;
  resource: AuditResource | string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  status?: AuditStatus | string;
  errorMessage?: string | null;
}

/**
 * Creates an audit log entry asynchronously (non-blocking)
 * Errors in logging will not break the application flow
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId || null,
        metadata: params.metadata || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        status: params.status || AuditStatus.SUCCESS,
        errorMessage: params.errorMessage || null,
      },
    });
  } catch (error) {
    // Log the error but don't throw - audit logging should never break app flow
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Creates an audit log entry without awaiting (fire-and-forget)
 * Useful for high-performance scenarios where blocking is not acceptable
 */
export function createAuditLogAsync(params: CreateAuditLogParams): void {
  createAuditLog(params).catch((error) => {
    console.error('Async audit log failed:', error);
  });
}

/**
 * Helper function for authentication login events
 */
export async function logAuthLogin(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.AUTH_LOGIN,
    resource: AuditResource.USER,
    resourceId: userId,
    ipAddress,
    userAgent,
    metadata,
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for failed authentication attempts
 */
export async function logAuthLoginFailed(
  email?: string,
  ipAddress?: string,
  userAgent?: string,
  errorMessage?: string
): Promise<void> {
  return createAuditLog({
    userId: null,
    action: AuditAction.AUTH_LOGIN_FAILED,
    resource: AuditResource.USER,
    ipAddress,
    userAgent,
    metadata: { email },
    status: AuditStatus.FAILURE,
    errorMessage,
  });
}

/**
 * Helper function for authentication logout events
 */
export async function logAuthLogout(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.AUTH_LOGOUT,
    resource: AuditResource.USER,
    resourceId: userId,
    ipAddress,
    userAgent,
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for user registration events
 */
export async function logAuthRegister(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.AUTH_REGISTER,
    resource: AuditResource.USER,
    resourceId: userId,
    ipAddress,
    userAgent,
    metadata,
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for passkey registration events
 */
export async function logPasskeyRegister(
  userId: string,
  credentialId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.PASSKEY_REGISTER,
    resource: AuditResource.PASSKEY,
    resourceId: credentialId,
    ipAddress,
    userAgent,
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for passkey verification events
 */
export async function logPasskeyVerify(
  userId: string,
  credentialId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.PASSKEY_VERIFY,
    resource: AuditResource.PASSKEY,
    resourceId: credentialId,
    ipAddress,
    userAgent,
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for spell creation events
 */
export async function logSpellCreated(
  userId: string,
  spellId: string,
  spellName: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.SPELL_CREATED,
    resource: AuditResource.SPELL,
    resourceId: spellId,
    metadata: { spellName, ...metadata },
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for spell update events
 */
export async function logSpellUpdated(
  userId: string,
  spellId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.SPELL_UPDATED,
    resource: AuditResource.SPELL,
    resourceId: spellId,
    metadata,
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for spell deletion events
 */
export async function logSpellDeleted(
  userId: string,
  spellId: string,
  spellName: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.SPELL_DELETED,
    resource: AuditResource.SPELL,
    resourceId: spellId,
    metadata: { spellName },
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for cast creation events
 */
export async function logCastCreated(
  userId: string,
  castId: string,
  spellId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.CAST_CREATED,
    resource: AuditResource.CAST,
    resourceId: castId,
    metadata: { spellId, ...metadata },
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for cast completion events
 */
export async function logCastCompleted(
  userId: string,
  castId: string,
  spellId: string,
  duration?: number,
  costCents?: number
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.CAST_COMPLETED,
    resource: AuditResource.CAST,
    resourceId: castId,
    metadata: { spellId, duration, costCents },
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for cast failure events
 */
export async function logCastFailed(
  userId: string,
  castId: string,
  spellId: string,
  errorMessage: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.CAST_FAILED,
    resource: AuditResource.CAST,
    resourceId: castId,
    metadata: { spellId },
    status: AuditStatus.FAILURE,
    errorMessage,
  });
}

/**
 * Helper function for payment success events
 */
export async function logPaymentSuccess(
  userId: string,
  paymentId: string,
  spellId: string,
  amountCents: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.PAYMENT_SUCCESS,
    resource: AuditResource.PAYMENT,
    resourceId: paymentId,
    metadata: { spellId, amountCents, ...metadata },
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for payment failure events
 */
export async function logPaymentFailed(
  userId: string,
  paymentId: string,
  spellId: string,
  errorMessage: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.PAYMENT_FAILED,
    resource: AuditResource.PAYMENT,
    resourceId: paymentId,
    metadata: { spellId },
    status: AuditStatus.FAILURE,
    errorMessage,
  });
}

/**
 * Helper function for checkout creation events
 */
export async function logPaymentCheckoutCreated(
  userId: string,
  checkoutSessionId: string,
  spellId: string,
  amountCents: number
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.PAYMENT_CHECKOUT_CREATED,
    resource: AuditResource.PAYMENT,
    resourceId: checkoutSessionId,
    metadata: { spellId, amountCents },
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for API key creation events
 */
export async function logApiKeyCreated(
  userId: string,
  apiKeyId: string,
  keyName: string,
  ipAddress?: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.API_KEY_CREATED,
    resource: AuditResource.API_KEY,
    resourceId: apiKeyId,
    metadata: { keyName },
    ipAddress,
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for API key revocation events
 */
export async function logApiKeyRevoked(
  userId: string,
  apiKeyId: string,
  keyName: string,
  ipAddress?: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.API_KEY_REVOKED,
    resource: AuditResource.API_KEY,
    resourceId: apiKeyId,
    metadata: { keyName },
    ipAddress,
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for budget update events
 */
export async function logBudgetUpdated(
  userId: string,
  budgetId: string,
  oldCapCents: number,
  newCapCents: number
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.BUDGET_UPDATED,
    resource: AuditResource.BUDGET,
    resourceId: budgetId,
    metadata: { oldCapCents, newCapCents },
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for budget cap exceeded events
 */
export async function logBudgetCapExceeded(
  userId: string,
  budgetId: string,
  currentSpendCents: number,
  monthlyCapCents: number
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.BUDGET_CAP_EXCEEDED,
    resource: AuditResource.BUDGET,
    resourceId: budgetId,
    metadata: { currentSpendCents, monthlyCapCents },
    status: AuditStatus.FAILURE,
  });
}

/**
 * Helper function for rate limit exceeded events
 */
export async function logRateLimitExceeded(
  userId: string | null,
  endpoint: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.RATE_LIMIT_EXCEEDED,
    resource: AuditResource.USER,
    ipAddress,
    userAgent,
    metadata: { endpoint },
    status: AuditStatus.FAILURE,
  });
}

/**
 * Helper function for invalid signature events
 */
export async function logInvalidSignature(
  endpoint: string,
  ipAddress?: string,
  errorMessage?: string
): Promise<void> {
  return createAuditLog({
    userId: null,
    action: AuditAction.INVALID_SIGNATURE,
    resource: AuditResource.SESSION,
    ipAddress,
    metadata: { endpoint },
    status: AuditStatus.FAILURE,
    errorMessage,
  });
}

/**
 * Helper function for unauthorized access attempts
 */
export async function logUnauthorizedAccess(
  endpoint: string,
  userId: string | null,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.UNAUTHORIZED_ACCESS,
    resource: AuditResource.USER,
    ipAddress,
    userAgent,
    metadata: { endpoint },
    status: AuditStatus.FAILURE,
  });
}

/**
 * Helper function for review creation events
 */
export async function logReviewCreated(
  userId: string,
  reviewId: string,
  spellId: string,
  castId: string,
  rating: number
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.REVIEW_CREATED,
    resource: AuditResource.REVIEW,
    resourceId: reviewId,
    metadata: { spellId, castId, rating },
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for chat message sent events
 */
export async function logChatMessageSent(
  userId: string,
  messageId: string,
  conversationId: string | null,
  role: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.CHAT_MESSAGE_SENT,
    resource: AuditResource.CHAT_MESSAGE,
    resourceId: messageId,
    metadata: { conversationId, role },
    ipAddress,
    userAgent,
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for chat conversation creation events
 */
export async function logChatConversationCreated(
  userId: string,
  conversationId: string,
  title?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.CHAT_CONVERSATION_CREATED,
    resource: AuditResource.CHAT_CONVERSATION,
    resourceId: conversationId,
    metadata: { title },
    ipAddress,
    userAgent,
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for chat conversation deletion events
 */
export async function logChatConversationDeleted(
  userId: string,
  conversationId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.CHAT_CONVERSATION_DELETED,
    resource: AuditResource.CHAT_CONVERSATION,
    resourceId: conversationId,
    ipAddress,
    userAgent,
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for artifact upload events
 */
export async function logArtifactUploaded(
  userId: string,
  castId: string,
  filename: string,
  size: number,
  storageKey: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.ARTIFACT_UPLOADED,
    resource: AuditResource.ARTIFACT,
    resourceId: castId,
    metadata: { filename, size, storageKey },
    ipAddress,
    userAgent,
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for artifact download events
 */
export async function logArtifactDownloaded(
  userId: string,
  castId: string,
  filename: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.ARTIFACT_DOWNLOADED,
    resource: AuditResource.ARTIFACT,
    resourceId: castId,
    metadata: { filename },
    ipAddress,
    userAgent,
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for artifact deletion events
 */
export async function logArtifactDeleted(
  userId: string,
  castId: string,
  filename: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.ARTIFACT_DELETED,
    resource: AuditResource.ARTIFACT,
    resourceId: castId,
    metadata: { filename },
    ipAddress,
    userAgent,
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for artifact access denied events
 */
export async function logArtifactAccessDenied(
  userId: string | null,
  castId: string,
  filename: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.ARTIFACT_ACCESS_DENIED,
    resource: AuditResource.ARTIFACT,
    resourceId: castId,
    metadata: { filename, reason },
    ipAddress,
    userAgent,
    status: AuditStatus.FAILURE,
  });
}

/**
 * Extract IP address from NextRequest headers
 */
export function getIpAddress(request: Request): string | null {
  const headers = request.headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    null
  );
}

/**
 * Extract user agent from NextRequest headers
 */
export function getUserAgent(request: Request): string | null {
  return request.headers.get('user-agent') || null;
}

/**
 * Extract both IP and user agent from request
 */
export function getRequestContext(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  return {
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
  };
}

/**
 * Helper function for WASM module upload events
 */
export async function logWasmModuleUploaded(
  userId: string,
  moduleId: string,
  spellId: string,
  version: string,
  size: number,
  hash: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.WASM_MODULE_UPLOADED,
    resource: AuditResource.WASM_MODULE,
    resourceId: moduleId,
    metadata: { spellId, version, size, hash },
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for WASM module validation events
 */
export async function logWasmModuleValidated(
  userId: string,
  moduleId: string,
  spellId: string,
  hash: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.WASM_MODULE_VALIDATED,
    resource: AuditResource.WASM_MODULE,
    resourceId: moduleId,
    metadata: { spellId, hash },
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for WASM module validation failure events
 */
export async function logWasmModuleValidationFailed(
  userId: string,
  spellId: string,
  reason: string,
  errorMessage: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.WASM_MODULE_VALIDATION_FAILED,
    resource: AuditResource.WASM_MODULE,
    metadata: { spellId, reason },
    status: AuditStatus.FAILURE,
    errorMessage,
  });
}

/**
 * Helper function for WASM execution started events
 */
export async function logWasmExecutionStarted(
  userId: string,
  castId: string,
  spellId: string,
  wasmVersion: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.WASM_EXECUTION_STARTED,
    resource: AuditResource.WASM_EXECUTION,
    resourceId: castId,
    metadata: { spellId, wasmVersion },
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for WASM execution completed events
 */
export async function logWasmExecutionCompleted(
  userId: string,
  castId: string,
  spellId: string,
  executionTimeMs: number,
  memoryUsedMb: number
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.WASM_EXECUTION_COMPLETED,
    resource: AuditResource.WASM_EXECUTION,
    resourceId: castId,
    metadata: { spellId, executionTimeMs, memoryUsedMb },
    status: AuditStatus.SUCCESS,
  });
}

/**
 * Helper function for WASM execution failed events
 */
export async function logWasmExecutionFailed(
  userId: string,
  castId: string,
  spellId: string,
  errorMessage: string
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.WASM_EXECUTION_FAILED,
    resource: AuditResource.WASM_EXECUTION,
    resourceId: castId,
    metadata: { spellId },
    status: AuditStatus.FAILURE,
    errorMessage,
  });
}

/**
 * Helper function for WASM execution timeout events
 */
export async function logWasmExecutionTimeout(
  userId: string,
  castId: string,
  spellId: string,
  timeoutMs: number
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.WASM_EXECUTION_TIMEOUT,
    resource: AuditResource.WASM_EXECUTION,
    resourceId: castId,
    metadata: { spellId, timeoutMs },
    status: AuditStatus.FAILURE,
    errorMessage: `Execution exceeded timeout of ${timeoutMs}ms`,
  });
}

/**
 * Helper function for WASM memory limit exceeded events
 */
export async function logWasmMemoryLimitExceeded(
  userId: string,
  castId: string,
  spellId: string,
  memoryLimitMb: number,
  memoryUsedMb: number
): Promise<void> {
  return createAuditLog({
    userId,
    action: AuditAction.WASM_MEMORY_LIMIT_EXCEEDED,
    resource: AuditResource.WASM_EXECUTION,
    resourceId: castId,
    metadata: { spellId, memoryLimitMb, memoryUsedMb },
    status: AuditStatus.FAILURE,
    errorMessage: `Memory usage (${memoryUsedMb}MB) exceeded limit (${memoryLimitMb}MB)`,
  });
}
