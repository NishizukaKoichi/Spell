# Real-Time Cast Status Updates (Server-Sent Events)

## Overview

This implementation provides real-time cast status updates using Server-Sent Events (SSE), allowing users to see cast execution progress without manual page refreshes.

## Architecture

### Components

1. **SSE Infrastructure** (`/src/lib/sse.ts`)
   - Core utilities for creating and managing SSE streams
   - Message formatting according to SSE specification
   - Connection lifecycle management
   - Heartbeat and timeout support

2. **Cast Events Publisher** (`/src/lib/cast-events.ts`)
   - Event publishing using NATS (with EventEmitter fallback)
   - Event types: status changes, progress updates, completion, failures
   - Subscription management for cast-specific and user-specific events

3. **Streaming Endpoint** (`/api/casts/[id]/events`)
   - GET endpoint that returns SSE stream
   - Authentication (session or API key)
   - Authorization (cast ownership verification)
   - Rate limiting (max 10 concurrent connections per user)
   - Auto-close on cast completion or 5-minute timeout

4. **Frontend Hook** (`/src/hooks/useCastEvents.ts`)
   - React hook for subscribing to cast events
   - Automatic reconnection with exponential backoff
   - Event handlers for status, progress, completion, errors
   - Polling fallback for browsers without SSE support

## Event Flow

```
Cast Creation/Update
        ↓
GitHub Webhook / Cast API
        ↓
publishCastEvent()
        ↓
    ┌───┴───┐
    ↓       ↓
  NATS   EventEmitter
    ↓       ↓
    └───┬───┘
        ↓
SSE Subscribers (via /api/casts/[id]/events)
        ↓
Frontend useCastEvents Hook
        ↓
Component State Update
        ↓
UI Re-render + Toast Notifications
```

## SSE Message Format

### Status Event
```
event: status
data: {
  "castId": "cast_123",
  "status": "running",
  "startedAt": "2025-11-06T10:00:00Z",
  "finishedAt": null,
  "duration": null,
  "costCents": 0,
  "artifactUrl": null,
  "errorMessage": null,
  "timestamp": "2025-11-06T10:00:00Z"
}
```

### Progress Event
```
event: progress
data: {
  "castId": "cast_123",
  "progress": 50,
  "message": "Processing step 2 of 4...",
  "timestamp": "2025-11-06T10:01:30Z"
}
```

### Complete Event
```
event: complete
data: {
  "castId": "cast_123",
  "status": "succeeded",
  "finishedAt": "2025-11-06T10:03:00Z",
  "duration": 180000,
  "costCents": 250,
  "artifactUrl": "/api/artifacts/123",
  "timestamp": "2025-11-06T10:03:00Z"
}
```

### Error Event
```
event: error
data: {
  "castId": "cast_123",
  "status": "failed",
  "errorMessage": "Workflow execution timed out",
  "timestamp": "2025-11-06T10:05:00Z"
}
```

## Usage

### Backend: Publishing Events

```typescript
import {
  publishCastStarted,
  publishCastCompleted,
  publishCastFailed,
  publishCastProgress
} from '@/lib/cast-events';

// When cast starts
await publishCastStarted(castId, userId, startedAt);

// Progress updates
await publishCastProgress(castId, userId, 50, 'Processing...');

// When cast completes
await publishCastCompleted(
  castId,
  userId,
  finishedAt,
  duration,
  costCents,
  artifactUrl
);

// When cast fails
await publishCastFailed(castId, userId, errorMessage, finishedAt);
```

### Frontend: Subscribing to Events

```typescript
import { useCastEvents } from '@/hooks/useCastEvents';

function CastDetail({ castId }) {
  const { isConnected, lastEvent, lastUpdate } = useCastEvents(
    { castId, enabled: true },
    {
      onStatus: (data) => {
        console.log('Status update:', data.status);
      },
      onProgress: (data) => {
        console.log('Progress:', data.progress);
      },
      onComplete: (data) => {
        toast.success('Cast completed!');
      },
      onError: (data) => {
        toast.error(`Cast failed: ${data.errorMessage}`);
      },
      onConnectionChange: (connected) => {
        if (!connected) {
          toast.warning('Connection lost, reconnecting...');
        }
      },
    }
  );

  return (
    <div>
      <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
      <p>Last Update: {lastUpdate?.toLocaleTimeString()}</p>
    </div>
  );
}
```

### Using the Simple Status Hook

```typescript
import { useCastStatus } from '@/hooks/useCastEvents';

function SimpleCastStatus({ castId }) {
  const { status, isTerminal, isConnected } = useCastStatus(castId);

  return (
    <div>
      <Badge>{status}</Badge>
      {isConnected && <Wifi />}
    </div>
  );
}
```

### Polling Fallback

For browsers that don't support SSE:

```typescript
import { useCastPolling } from '@/hooks/useCastEvents';

function CastStatusFallback({ castId }) {
  const { cast, isPolling, error } = useCastPolling(castId, {
    interval: 5000,
    onUpdate: (cast) => {
      console.log('Cast updated:', cast);
    },
  });

  return <div>{cast?.status}</div>;
}
```

## Security & Rate Limiting

### Authentication
- Session-based (via NextAuth)
- API key-based (via Bearer token or x-api-key header)

### Authorization
- Users can only subscribe to their own casts
- Ownership verified before establishing SSE connection

### Rate Limits
- Anonymous: 20 connections/minute
- Authenticated: 100 connections/minute
- API Key: 60 connections/minute
- Max 10 concurrent SSE connections per user

### Audit Logging

All SSE connections are logged:
- `cast.sse_connection_opened`
- `cast.sse_connection_closed` (with duration and message count)
- `cast.sse_connection_failed`
- `cast.status_changed`

## Connection Lifecycle

1. **Connection Establishment**
   - Client opens GET request to `/api/casts/[id]/events`
   - Server validates authentication & authorization
   - Server checks rate limits and connection count
   - Server creates SSE stream and sends initial status

2. **Active Connection**
   - Heartbeat sent every 30 seconds
   - Events sent as they occur (status changes, progress, etc.)
   - Client automatically reconnects on disconnect

3. **Connection Termination**
   - Cast reaches terminal state (succeeded/failed)
   - 5-minute timeout expires
   - Client disconnects
   - Server error occurs

## Event Publishing Integration Points

1. **Cast Creation** (`/api/casts`)
   - Publishes initial 'queued' status

2. **GitHub Webhook** (`/api/webhooks/github`)
   - `workflow_run.in_progress` → publishes 'started' event
   - `workflow_run.completed` → publishes 'completed' or 'failed' event

3. **Cast Update** (`/api/casts/[id]`)
   - Manual status updates → publishes status change event

4. **Payment Webhook** (`/api/webhooks/stripe`)
   - Payment success → can trigger cast execution

## Performance Considerations

### Server-Side
- In-memory EventEmitter for single-instance deployments
- NATS for distributed/multi-instance deployments
- Max 10 concurrent SSE connections per user
- Automatic cleanup of closed connections
- Connection pooling for database queries

### Client-Side
- Single SSE connection per cast detail page
- Polling (5s interval) for cast list pages
- Automatic reconnection with exponential backoff
- Connection closed when cast reaches terminal state

## Monitoring & Debugging

### Server Logs
```
[SSE] Connected to cast cast_123
[SSE] Connection timeout for cast cast_123
[Cast Events] Published event: status_changed for cast cast_123
```

### Client Console
```
[SSE] Connected to cast cast_123
[SSE] Reconnecting in 5000ms (attempt 1/10)
```

### Audit Logs Query
```sql
SELECT * FROM audit_logs
WHERE action LIKE 'cast.sse_%'
ORDER BY created_at DESC;
```

## Testing

### Unit Tests
- SSE message formatting
- Stream creation and cleanup
- Event publishing and subscription
- Connection lifecycle management

### Integration Tests
- End-to-end cast status updates
- Authentication and authorization
- Rate limiting enforcement
- Reconnection behavior

### Manual Testing
```bash
# Test SSE endpoint directly
curl -N -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/casts/CAST_ID/events

# Expected output:
# event: status
# data: {"castId":"...","status":"running",...}
#
# : heartbeat 1234567890
#
# event: complete
# data: {"castId":"...","status":"succeeded",...}
```

## Troubleshooting

### Connection Drops Immediately
- Check authentication (session or API key)
- Verify cast ownership
- Check rate limit status
- Ensure cast is not in terminal state

### No Events Received
- Verify event publishing is working (check server logs)
- Ensure NATS is connected (if using distributed setup)
- Check EventEmitter subscriptions (if using single instance)
- Verify cast ID matches

### Multiple Reconnections
- Check network stability
- Verify server isn't restarting
- Check max reconnection attempts (default: 10)
- Review reconnection interval (default: 5s)

### High Server Load
- Check number of concurrent SSE connections
- Verify rate limiting is enforced
- Consider scaling with NATS for distributed load
- Monitor EventEmitter listener count

## Future Enhancements

1. **WebSocket Support**
   - Bidirectional communication
   - Lower latency for high-frequency updates
   - Custom protocol for cast events

2. **Batch Updates**
   - Group multiple status changes
   - Reduce message overhead
   - Configurable batch interval

3. **Selective Subscriptions**
   - Subscribe to specific event types only
   - Filter by cast status
   - User preferences for notifications

4. **Replay Support**
   - Request historical events
   - Event sourcing for cast timeline
   - Persistent event store

5. **Analytics**
   - Connection duration metrics
   - Message frequency analysis
   - User engagement tracking
   - Performance monitoring

## Related Documentation

- [SSE Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [Audit Logging](./AUDIT_LOGGING_IMPLEMENTATION.md)
- [Rate Limiting](../src/lib/rate-limit.ts)
- [NATS Documentation](https://docs.nats.io/)
