# Chat Backend Deployment Checklist

This checklist guides you through deploying the chat backend integration to production.

## Pre-Deployment Checklist

### 1. Environment Setup

- [ ] Database is accessible and configured
- [ ] PostgreSQL version is 12 or higher
- [ ] Environment variables are set:
  ```bash
  DATABASE_URL=postgresql://...
  NEXTAUTH_URL=https://your-domain.com
  AUTH_SECRET=your-secret-key

  # Optional: For AI integration
  OPENAI_API_KEY=sk-...
  # OR
  ANTHROPIC_API_KEY=sk-ant-...
  ```

### 2. Database Migration

- [ ] Backup existing database
  ```bash
  pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
  ```

- [ ] Generate Prisma client
  ```bash
  npx prisma generate
  ```

- [ ] Review migration SQL
  ```bash
  cat prisma/migrations/20251106044500_add_chat_models/migration.sql
  ```

- [ ] Apply migration to staging environment first
  ```bash
  DATABASE_URL=$STAGING_DATABASE_URL npx prisma migrate deploy
  ```

- [ ] Verify migration success
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('chat_conversations', 'chat_messages');
  ```

- [ ] Apply migration to production
  ```bash
  npx prisma migrate deploy
  ```

### 3. Code Deployment

- [ ] Run type checking
  ```bash
  pnpm typecheck
  ```

- [ ] Run linter
  ```bash
  pnpm lint
  ```

- [ ] Build application
  ```bash
  pnpm build
  ```

- [ ] Run tests (after Prisma client generation)
  ```bash
  pnpm test
  ```

### 4. AI Integration (Optional)

- [ ] Choose AI provider (OpenAI or Anthropic)
- [ ] Install SDK
  ```bash
  # OpenAI
  pnpm add openai

  # OR Anthropic
  pnpm add @anthropic-ai/sdk
  ```

- [ ] Update `generateAIResponse()` in `/src/lib/chat.ts`
- [ ] Set API key in environment
- [ ] Test AI responses in staging
- [ ] Monitor API usage and costs

### 5. Security Verification

- [ ] Rate limiting is enabled
  - Check `/src/app/api/chat/messages/route.ts`
  - Default: 100 requests/minute for authenticated users

- [ ] Authentication is required for all chat endpoints
  - All routes use `await auth()` to verify session

- [ ] Input validation is active
  - Message content: 1-10,000 characters
  - XSS prevention via sanitization

- [ ] Audit logging is enabled
  - Verify logs are being created in `audit_logs` table

- [ ] CORS is properly configured
  - Check Next.js configuration

- [ ] API responses don't leak sensitive data
  - Review error messages in production mode

### 6. Performance Tuning

- [ ] Database indexes are created
  ```sql
  -- Verify indexes exist
  SELECT indexname, tablename FROM pg_indexes
  WHERE tablename IN ('chat_conversations', 'chat_messages');
  ```

- [ ] Connection pooling is configured
  - Check Prisma connection pool settings

- [ ] Rate limiter storage is appropriate
  - In-memory for single-instance
  - Redis for multi-instance deployments

- [ ] CDN is configured for static assets

### 7. Monitoring Setup

- [ ] Add logging for chat operations
  ```typescript
  console.log('[Chat] Message sent', { userId, messageId });
  ```

- [ ] Set up error tracking (Sentry, etc.)

- [ ] Configure performance monitoring

- [ ] Set up alerts for:
  - High error rates
  - Rate limit hits
  - Database connection issues
  - AI API failures

- [ ] Dashboard for chat metrics:
  - Messages per day
  - Active conversations
  - Response times
  - Error rates

### 8. Testing in Production

- [ ] Create test user account
- [ ] Send test messages
  ```bash
  curl -X POST https://your-domain.com/api/chat/messages \
    -H "Content-Type: application/json" \
    -H "Cookie: session-token" \
    -d '{"content":"Hello, AI!"}'
  ```

- [ ] Verify messages are stored in database
- [ ] Check audit logs are created
- [ ] Test conversation creation
- [ ] Test message history retrieval
- [ ] Test streaming endpoint (if using)
- [ ] Verify rate limiting works
- [ ] Test error handling

## Post-Deployment Verification

### Database Checks

```sql
-- Check tables exist
SELECT * FROM chat_conversations LIMIT 1;
SELECT * FROM chat_messages LIMIT 1;

-- Check indexes
EXPLAIN SELECT * FROM chat_messages WHERE user_id = 'test_id' ORDER BY created_at DESC;

-- Check foreign keys
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('chat_conversations', 'chat_messages');
```

### API Endpoint Tests

```bash
# Health check
curl https://your-domain.com/api/health

# Get messages (requires auth)
curl https://your-domain.com/api/chat/messages?limit=10 \
  -H "Cookie: session-token"

# Send message (requires auth)
curl -X POST https://your-domain.com/api/chat/messages \
  -H "Content-Type: application/json" \
  -H "Cookie: session-token" \
  -d '{"content":"Test message"}'

# Get conversations (requires auth)
curl https://your-domain.com/api/chat/conversations \
  -H "Cookie: session-token"
```

### Performance Tests

```bash
# Load testing (use a tool like k6 or artillery)
artillery quick --count 100 --num 10 https://your-domain.com/api/chat/messages

# Monitor database performance
SELECT * FROM pg_stat_statements
WHERE query LIKE '%chat_%'
ORDER BY total_exec_time DESC;
```

### Audit Log Verification

```sql
-- Check recent chat actions
SELECT
    action,
    resource,
    status,
    COUNT(*) as count,
    MAX(created_at) as last_occurrence
FROM audit_logs
WHERE action LIKE 'chat.%'
GROUP BY action, resource, status
ORDER BY last_occurrence DESC;

-- Check for errors
SELECT * FROM audit_logs
WHERE action LIKE 'chat.%'
    AND status = 'failure'
ORDER BY created_at DESC
LIMIT 10;
```

## Rollback Plan

If issues occur:

### 1. Disable Chat Features
```typescript
// Add to middleware or route handler
if (process.env.CHAT_DISABLED === 'true') {
  return new Response('Chat temporarily unavailable', { status: 503 });
}
```

### 2. Rollback Database Migration
```bash
# Only if no data loss is acceptable
npx prisma migrate resolve --rolled-back 20251106044500_add_chat_models
```

### 3. Revert Code Changes
```bash
git revert <commit-hash>
git push
```

### 4. Restore Database Backup
```bash
# If data corruption occurs
psql $DATABASE_URL < backup_20251106.sql
```

## Monitoring Dashboard Queries

### Messages Per Hour
```sql
SELECT
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as message_count,
    COUNT(DISTINCT user_id) as unique_users
FROM chat_messages
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### Active Conversations
```sql
SELECT
    COUNT(*) as total_conversations,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(message_count) as avg_messages_per_conversation
FROM (
    SELECT
        conversation_id,
        user_id,
        COUNT(*) as message_count
    FROM chat_messages
    WHERE conversation_id IS NOT NULL
    GROUP BY conversation_id, user_id
) as conv_stats;
```

### Response Times (from audit logs)
```sql
SELECT
    DATE_TRUNC('hour', created_at) as hour,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_response_time_seconds
FROM audit_logs
WHERE action = 'chat.message_sent'
    AND status = 'success'
    AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### Error Rate
```sql
SELECT
    action,
    COUNT(CASE WHEN status = 'failure' THEN 1 END) as failures,
    COUNT(*) as total,
    ROUND(100.0 * COUNT(CASE WHEN status = 'failure' THEN 1 END) / COUNT(*), 2) as error_rate_percent
FROM audit_logs
WHERE action LIKE 'chat.%'
    AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY action;
```

## Scaling Considerations

### When to Scale

- Message volume > 1000/minute
- Response time > 2 seconds
- Database CPU > 70%
- Rate limiter memory > 1GB

### Scaling Options

1. **Database**
   - Add read replicas for message history
   - Partition messages table by user_id or created_at
   - Implement database connection pooling

2. **Application**
   - Deploy multiple instances behind load balancer
   - Move rate limiter to Redis
   - Implement message queue for AI processing

3. **Caching**
   - Cache conversation lists
   - Cache recent messages
   - Use CDN for static assets

4. **AI Processing**
   - Queue AI requests for async processing
   - Implement response caching for common queries
   - Consider fine-tuned models for faster responses

## Troubleshooting

### Common Issues

#### Messages Not Saving
```sql
-- Check database connection
SELECT 1;

-- Check if migration ran
SELECT * FROM _prisma_migrations
WHERE migration_name = '20251106044500_add_chat_models';

-- Check table structure
\d chat_messages
```

#### Rate Limiting Too Aggressive
```typescript
// Adjust in /src/lib/rate-limit.ts
export const RATE_LIMIT_TIERS: Record<RateLimitTier, number> = {
  [RateLimitTier.AUTHENTICATED]: 200, // Increased from 100
  // ...
};
```

#### AI Responses Slow
- Check AI service status
- Review API rate limits
- Consider response streaming
- Implement timeout handling

#### High Database Load
```sql
-- Find slow queries
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%chat_%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check missing indexes
SELECT
    schemaname,
    tablename,
    attname,
    null_frac,
    avg_width,
    n_distinct,
    correlation
FROM pg_stats
WHERE tablename IN ('chat_messages', 'chat_conversations')
ORDER BY null_frac DESC;
```

## Support Contacts

- **Database Issues**: DBA team
- **Application Issues**: Backend team
- **AI Service Issues**: AI team / vendor support
- **Security Issues**: Security team

## Additional Resources

- [CHAT_INTEGRATION_GUIDE.md](/CHAT_INTEGRATION_GUIDE.md) - Complete implementation guide
- [CHAT_IMPLEMENTATION_SUMMARY.md](/CHAT_IMPLEMENTATION_SUMMARY.md) - Implementation overview
- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Anthropic API Docs](https://docs.anthropic.com)

---

**Last Updated**: 2025-11-06
**Version**: 1.0.0
