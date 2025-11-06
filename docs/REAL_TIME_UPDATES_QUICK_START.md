# Real-Time Cast Updates - Quick Start Guide

## For Frontend Developers

### Basic Usage

```typescript
import { useCastEvents } from '@/hooks/useCastEvents';

function MyCastComponent({ castId }) {
  const { isConnected, lastEvent } = useCastEvents(
    { castId },
    {
      onStatus: (data) => {
        console.log('New status:', data.status);
      },
      onComplete: (data) => {
        toast.success('Cast completed!');
      },
    }
  );

  return (
    <div>
      <Badge>{lastEvent?.status}</Badge>
      {isConnected && <WifiIcon />}
    </div>
  );
}
```

### With All Event Handlers

```typescript
const { isConnected, lastEvent, lastUpdate, error } = useCastEvents(
  {
    castId: 'cast_123',
    enabled: true,
    reconnect: true,
    maxReconnectAttempts: 10,
  },
  {
    onStatus: (data) => {
      // Handle status changes
      setCast(prev => ({ ...prev, status: data.status }));
    },
    onProgress: (data) => {
      // Handle progress updates
      setProgress(data.progress);
      if (data.message) {
        toast.info(data.message);
      }
    },
    onComplete: (data) => {
      // Handle completion
      toast.success('Execution completed!');
      setCast(prev => ({ ...prev, status: 'succeeded' }));
    },
    onError: (data) => {
      // Handle errors
      toast.error(data.errorMessage || 'Execution failed');
      setCast(prev => ({ ...prev, status: 'failed' }));
    },
    onConnectionChange: (connected) => {
      // Handle connection state changes
      setIsLive(connected);
    },
  }
);
```

### Simple Status-Only Hook

```typescript
import { useCastStatus } from '@/hooks/useCastEvents';

function SimpleCast({ castId }) {
  const { status, isTerminal, isConnected } = useCastStatus(castId);

  return (
    <div>
      <span>{status}</span>
      {!isTerminal && isConnected && <span>🟢 Live</span>}
    </div>
  );
}
```

### Polling Fallback (for old browsers)

```typescript
import { useCastPolling } from '@/hooks/useCastEvents';

function CastWithFallback({ castId }) {
  const { cast, isPolling } = useCastPolling(castId, {
    interval: 5000,
    onUpdate: (updatedCast) => {
      console.log('Cast updated via polling:', updatedCast);
    },
  });

  return <div>{cast?.status}</div>;
}
```

## For Backend Developers

### Publishing Events from API Routes

```typescript
import {
  publishCastStatusChange,
  publishCastStarted,
  publishCastCompleted,
  publishCastFailed,
} from '@/lib/cast-events';

// After creating a cast
await publishCastStatusChange(cast.id, userId, 'queued');

// When workflow starts
await publishCastStarted(cast.id, userId, new Date());

// On successful completion
await publishCastCompleted(
  cast.id,
  userId,
  finishedAt,
  duration,
  costCents,
  artifactUrl
);

// On failure
await publishCastFailed(cast.id, userId, errorMessage);
```

### Publishing from GitHub Webhooks

Already integrated! Events are automatically published when GitHub webhooks are received:

```typescript
// In /api/webhooks/github/route.ts
case 'in_progress':
  await publishCastStarted(castId, userId, startedAt);
  break;

case 'completed':
  if (isSuccess) {
    await publishCastCompleted(...);
  } else {
    await publishCastFailed(...);
  }
  break;
```

### Manual Event Publishing

```typescript
import { publishCastUpdate } from '@/lib/cast-events';

// After any cast database update
await prisma.cast.update({ ... });
await publishCastUpdate(castId); // Publishes current state
```

## Testing

### Test SSE Endpoint with curl

```bash
curl -N \
  -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/casts/CAST_ID/events
```

### Test with EventSource in Browser Console

```javascript
const es = new EventSource('/api/casts/CAST_ID/events');

es.addEventListener('status', (e) => {
  console.log('Status:', JSON.parse(e.data));
});

es.addEventListener('complete', (e) => {
  console.log('Complete:', JSON.parse(e.data));
  es.close();
});

es.onerror = (e) => {
  console.error('Error:', e);
};
```

### Unit Testing Components

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useCastEvents } from '@/hooks/useCastEvents';

test('connects to SSE stream', async () => {
  const { result } = renderHook(() =>
    useCastEvents({ castId: 'test-123' })
  );

  await waitFor(() => {
    expect(result.current.isConnected).toBe(true);
  });
});
```

## Common Patterns

### Loading State

```typescript
function CastWithLoading({ castId }) {
  const [cast, setCast] = useState(null);
  const [loading, setLoading] = useState(true);

  const { isConnected } = useCastEvents(
    { castId, enabled: !loading },
    {
      onStatus: (data) => {
        setCast((prev) => ({ ...prev, ...data }));
      },
    }
  );

  useEffect(() => {
    // Fetch initial cast data
    fetch(`/api/casts/${castId}`)
      .then((r) => r.json())
      .then((data) => {
        setCast(data);
        setLoading(false);
      });
  }, [castId]);

  if (loading) return <Spinner />;

  return <div>{cast.status}</div>;
}
```

### Optimistic Updates

```typescript
function CastWithOptimistic({ castId }) {
  const [cast, setCast] = useState(initialCast);

  useCastEvents(
    { castId },
    {
      onStatus: (data) => {
        // Real-time update overwrites optimistic update
        setCast((prev) => ({
          ...prev,
          status: data.status,
          // Only update if newer
          updatedAt: data.timestamp,
        }));
      },
    }
  );

  const handleCancel = async () => {
    // Optimistic update
    setCast((prev) => ({ ...prev, status: 'cancelled' }));

    try {
      await fetch(`/api/casts/${castId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      });
    } catch (error) {
      // Revert on error
      setCast((prev) => ({ ...prev, status: 'running' }));
    }
  };

  return <div>{cast.status}</div>;
}
```

### Multiple Casts

```typescript
function CastList({ castIds }) {
  const [casts, setCasts] = useState({});

  // Subscribe to each cast
  castIds.forEach((castId) => {
    useCastEvents(
      { castId },
      {
        onStatus: (data) => {
          setCasts((prev) => ({
            ...prev,
            [castId]: { ...prev[castId], ...data },
          }));
        },
      }
    );
  });

  return (
    <div>
      {castIds.map((id) => (
        <CastRow key={id} cast={casts[id]} />
      ))}
    </div>
  );
}
```

Note: For list pages with many casts, use polling instead to avoid too many SSE connections.

## Environment Variables

No additional environment variables needed! Works out of the box.

Optional NATS configuration for distributed deployments:

```env
# Optional: NATS configuration for multi-instance deployments
NATS_URL=nats://localhost:4222
NATS_CLIENT_NAME=spell-platform-web
NATS_MAX_RECONNECT_ATTEMPTS=5
NATS_RECONNECT_TIME_WAIT_MS=2000
```

## Troubleshooting

### "Connection closed immediately"
- Check if cast is in terminal state (succeeded/failed)
- Verify authentication (logged in or valid API key)
- Check cast ownership

### "Connection keeps reconnecting"
- Check server logs for errors
- Verify NATS is running (if configured)
- Check rate limits

### "No events received"
- Verify cast status is changing
- Check server logs for event publishing
- Test with curl to isolate frontend issues

### "Too many connections error"
- Max 10 concurrent SSE connections per user
- Close unused connections
- Use polling for list pages

## Best Practices

1. **Only use SSE for detail pages** - Use polling for list pages
2. **Close connections when component unmounts** - Handled automatically by hook
3. **Show connection status** - Use `isConnected` to show live indicator
4. **Handle reconnections gracefully** - Show reconnecting state to user
5. **Don't connect to completed casts** - Check terminal state before enabling
6. **Use polling as fallback** - For browsers without SSE support
7. **Show last update time** - Use `lastUpdate` for transparency

## Next Steps

- Read full documentation: [REAL_TIME_CAST_UPDATES.md](./REAL_TIME_CAST_UPDATES.md)
- Review SSE specification: https://html.spec.whatwg.org/multipage/server-sent-events.html
- Explore NATS for distributed setups: https://docs.nats.io/
