# Audit Logging System Implementation

## Overview

A comprehensive audit logging system has been implemented for the Spell platform to track security events, user actions, payments, and system operations for compliance, debugging, and security purposes.

## Database Schema

### AuditLog Model

Location: `/home/user/Spell/prisma/schema.prisma`

```prisma
model AuditLog {
  id           String   @id @default(cuid())
  userId       String?
  action       String
  resource     String
  resourceId   String?
  metadata     Json?
  ipAddress    String?
  userAgent    String?
  status       String   @default("success")
  errorMessage String?
  createdAt    DateTime @default(now())
  user         User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([action])
  @@index([resource])
  @@index([status])
  @@index([createdAt])
  @@index([userId, createdAt])
  @@index([action, createdAt])
  @@map("audit_logs")
}
```

### Indexes

The following indexes have been created for optimal query performance:
- `userId` - For user-specific log queries
- `action` - For filtering by action type
- `resource` - For filtering by resource type
- `status` - For filtering by success/failure
- `createdAt` - For time-based queries
- `userId, createdAt` - Composite index for user timeline queries
- `action, createdAt` - Composite index for action timeline queries

## Audit Logging Library

Location: `/home/user/Spell/src/lib/audit-log.ts`

### Event Types

#### Authentication Events
- `AUTH_LOGIN` - User login
- `AUTH_LOGOUT` - User logout
- `AUTH_REGISTER` - User registration
- `AUTH_LOGIN_FAILED` - Failed login attempt

#### Passkey/WebAuthn Events
- `PASSKEY_REGISTER` - Passkey registration
- `PASSKEY_VERIFY` - Passkey verification
- `PASSKEY_REGISTER_FAILED` - Failed passkey registration
- `PASSKEY_VERIFY_FAILED` - Failed passkey verification

#### Spell Management Events
- `SPELL_CREATED` - Spell creation
- `SPELL_UPDATED` - Spell update
- `SPELL_DELETED` - Spell deletion
- `SPELL_VIEWED` - Spell view (optional)

#### Cast Execution Events
- `CAST_CREATED` - Cast creation/queued
- `CAST_STARTED` - Cast execution started
- `CAST_COMPLETED` - Cast execution completed
- `CAST_FAILED` - Cast execution failed
- `CAST_CANCELLED` - Cast cancelled

#### Payment Events
- `PAYMENT_CHECKOUT_CREATED` - Checkout session created
- `PAYMENT_SUCCESS` - Payment successful
- `PAYMENT_FAILED` - Payment failed
- `PAYMENT_CANCELLED` - Payment cancelled

#### API Key Management Events
- `API_KEY_CREATED` - API key created
- `API_KEY_REVOKED` - API key revoked
- `API_KEY_USED` - API key used (optional)

#### Budget Events
- `BUDGET_UPDATED` - Budget cap updated
- `BUDGET_RESET` - Budget reset
- `BUDGET_CAP_EXCEEDED` - Budget cap exceeded

#### Security Events
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `INVALID_SIGNATURE` - Invalid webhook signature
- `UNAUTHORIZED_ACCESS` - Unauthorized access attempt
- `IDEMPOTENCY_CONFLICT` - Idempotency conflict detected

#### Review Events
- `REVIEW_CREATED` - Review created
- `REVIEW_UPDATED` - Review updated
- `REVIEW_DELETED` - Review deleted

### Core Functions

#### `createAuditLog(params: CreateAuditLogParams): Promise<void>`

Creates an audit log entry. This function is non-blocking and handles errors gracefully - logging failures will not break application flow.

```typescript
await createAuditLog({
  userId: 'user-123',
  action: AuditAction.AUTH_LOGIN,
  resource: AuditResource.USER,
  resourceId: 'user-123',
  metadata: { method: 'passkey' },
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
  status: AuditStatus.SUCCESS,
});
```

#### `createAuditLogAsync(params: CreateAuditLogParams): void`

Fire-and-forget version that doesn't block execution. Useful for high-performance scenarios.

### Helper Functions

The library includes numerous helper functions for common audit events:

- `logAuthLogin()` - Log user login
- `logAuthRegister()` - Log user registration
- `logAuthLogout()` - Log user logout
- `logPasskeyRegister()` - Log passkey registration
- `logPasskeyVerify()` - Log passkey verification
- `logSpellCreated()` - Log spell creation
- `logSpellUpdated()` - Log spell update
- `logSpellDeleted()` - Log spell deletion
- `logCastCreated()` - Log cast creation
- `logCastCompleted()` - Log cast completion
- `logCastFailed()` - Log cast failure
- `logPaymentSuccess()` - Log successful payment
- `logPaymentFailed()` - Log failed payment
- `logPaymentCheckoutCreated()` - Log checkout creation
- `logApiKeyCreated()` - Log API key creation
- `logApiKeyRevoked()` - Log API key revocation
- `logBudgetUpdated()` - Log budget update
- `logBudgetCapExceeded()` - Log budget cap exceeded
- `logRateLimitExceeded()` - Log rate limit exceeded
- `logInvalidSignature()` - Log invalid signature
- `logUnauthorizedAccess()` - Log unauthorized access
- `logReviewCreated()` - Log review creation

### Request Context Helpers

- `getIpAddress(request: Request): string | null` - Extract IP address from request headers
- `getUserAgent(request: Request): string | null` - Extract user agent from request headers
- `getRequestContext(request: Request)` - Extract both IP and user agent

## Integration Points

### Authentication Flows

#### WebAuthn Registration
Location: `/home/user/Spell/src/app/api/webauthn/register-verify/route.ts`

Logs:
- Passkey registration (`PASSKEY_REGISTER`)
- User registration (`AUTH_REGISTER`)

#### WebAuthn Authentication
Location: `/home/user/Spell/src/app/api/webauthn/auth-verify/route.ts`

Logs:
- Passkey verification (`PASSKEY_VERIFY`)
- User login (`AUTH_LOGIN`)

### Payment Flows

#### Checkout Session Creation
Location: `/home/user/Spell/src/app/api/create-checkout-session/route.ts`

Logs:
- Checkout session created (`PAYMENT_CHECKOUT_CREATED`)

#### Stripe Webhooks
Location: `/home/user/Spell/src/app/api/webhooks/stripe/route.ts`

Logs:
- Payment success (`PAYMENT_SUCCESS`)
- Payment failure (`PAYMENT_FAILED`)
- Invalid signature (`INVALID_SIGNATURE`)

### Spell Management

#### Spell Creation
Location: `/home/user/Spell/src/app/api/spells/create/route.ts`

Logs:
- Spell created (`SPELL_CREATED`)

#### Spell Update/Delete
Location: `/home/user/Spell/src/app/api/spells/[id]/route.ts`

Logs:
- Spell updated (`SPELL_UPDATED`)
- Spell deleted (`SPELL_DELETED`)

### Cast Execution

#### Cast Creation
Location: `/home/user/Spell/src/app/api/cast/route.ts`

Logs:
- Cast created (`CAST_CREATED`)

### API Key Management

#### API Key Creation
Location: `/home/user/Spell/src/app/api/keys/route.ts`

Logs:
- API key created (`API_KEY_CREATED`)

#### API Key Deletion
Location: `/home/user/Spell/src/app/api/keys/[id]/route.ts`

Logs:
- API key revoked (`API_KEY_REVOKED`)

## API Endpoint

### GET /api/audit-logs

Location: `/home/user/Spell/src/app/api/audit-logs/route.ts`

Fetch audit logs with filtering and pagination. Only returns logs for the authenticated user.

#### Query Parameters

- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50, max: 100)
- `action` - Filter by action type
- `resource` - Filter by resource type
- `status` - Filter by status (success/failure)
- `startDate` - Filter logs from this date (ISO string)
- `endDate` - Filter logs until this date (ISO string)

#### Response Format

```json
{
  "logs": [
    {
      "id": "log-id",
      "action": "auth.login",
      "resource": "user",
      "resourceId": "user-123",
      "metadata": { "method": "passkey" },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0",
      "status": "success",
      "errorMessage": null,
      "createdAt": "2025-11-06T05:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalCount": 150,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

#### Authorization

Requires authenticated session. Users can only view their own audit logs.

## UI Component

### AuditLogList Component

Location: `/home/user/Spell/src/components/audit-log-list.tsx`

A React client component for displaying audit logs with filtering and pagination.

#### Features

- Real-time filtering by action, resource, and status
- Pagination support
- Formatted timestamps
- Status badges (success/failure)
- Expandable metadata details
- Responsive table layout

#### Usage

```tsx
import { AuditLogList } from '@/components/audit-log-list';

// Basic usage
<AuditLogList />

// With filters
<AuditLogList
  actionFilter="auth.login"
  resourceFilter="user"
  pageSize={25}
  showFilters={true}
/>
```

#### Props

- `actionFilter?: string` - Pre-filter by action type
- `resourceFilter?: string` - Pre-filter by resource type
- `pageSize?: number` - Number of logs per page (default: 50)
- `showFilters?: boolean` - Show/hide filter UI (default: true)

## Testing

Location: `/home/user/Spell/tests/lib/audit-log.test.ts`

Comprehensive test suite covering:

- Audit log creation with all fields
- Audit log creation with minimal fields
- Error handling (non-blocking behavior)
- All helper functions
- Request context extraction
- Enum values validation

Run tests:
```bash
npm test
```

## Database Migration

Location: `/home/user/Spell/prisma/migrations/20251106050000_add_audit_logs/migration.sql`

The migration file creates:
- `audit_logs` table with all required fields
- All performance indexes
- Foreign key relationship to `users` table with SET NULL on delete

### Applying the Migration

In development:
```bash
npx prisma migrate dev
```

In production:
```bash
npx prisma migrate deploy
```

### Generating Prisma Client

After pulling changes:
```bash
npx prisma generate
```

## Security Considerations

1. **Privacy**: User-specific logs are isolated - users can only view their own logs
2. **Sensitive Data**: API keys and passwords are never logged
3. **Error Handling**: Audit logging failures don't break application functionality
4. **IP Tracking**: IP addresses are logged for security analysis
5. **Soft Deletes**: Audit logs have SET NULL relationship - they persist even if users are deleted

## Performance Considerations

1. **Async Logging**: All audit logging is non-blocking
2. **Indexed Queries**: Composite indexes optimize common query patterns
3. **Pagination**: API enforces maximum page size to prevent large queries
4. **Selective Fields**: API responses only include necessary fields

## Future Enhancements

Potential improvements for Wave 2:

1. **Admin Dashboard**: System-wide audit log viewer for admins
2. **Retention Policy**: Automated cleanup of old logs
3. **Export Functionality**: CSV/JSON export for compliance
4. **Real-time Notifications**: Alert on suspicious activity
5. **Advanced Search**: Full-text search on metadata
6. **Analytics**: Aggregate statistics and trends
7. **Webhook Integration**: External notification system
8. **Compliance Reports**: Pre-built compliance report templates

## Troubleshooting

### Audit logs not appearing

1. Check that Prisma migration has been applied
2. Verify user is authenticated
3. Check browser console for API errors
4. Verify database connectivity

### Performance issues

1. Ensure database indexes are created
2. Reduce page size in queries
3. Add date range filters to limit results
4. Consider archiving old logs

### Testing failures

1. Ensure mock setup is correct
2. Check that Prisma client types are generated
3. Verify test database is accessible

## Maintenance

### Regular Tasks

1. **Monitor Log Volume**: Check audit log table size regularly
2. **Review Failed Events**: Investigate failure patterns
3. **Archive Old Logs**: Consider archiving logs older than 90 days
4. **Index Maintenance**: Monitor and optimize database indexes
5. **Security Review**: Regularly review suspicious activity logs

### Monitoring Queries

Check total log count:
```sql
SELECT COUNT(*) FROM audit_logs;
```

Check failure rate:
```sql
SELECT status, COUNT(*)
FROM audit_logs
GROUP BY status;
```

Recent failed actions:
```sql
SELECT action, COUNT(*)
FROM audit_logs
WHERE status = 'failure'
  AND "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY action;
```

## Summary

The audit logging system provides comprehensive tracking of all important platform events. It's designed to be:

- **Non-intrusive**: Failures don't break app functionality
- **Performant**: Async operations and optimized indexes
- **Secure**: User data isolation and privacy protection
- **Extensible**: Easy to add new event types
- **Compliant**: Supports audit and compliance requirements

All core functionality is implemented and integrated throughout the application. The system is ready for production use and can be extended as needed in future iterations.
