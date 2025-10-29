# Getting Started with Spell Platform API

This guide will help you get started with using the Spell Platform API.

## Table of Contents

1. [Create an Account](#create-an-account)
2. [Generate an API Key](#generate-an-api-key)
3. [Your First Cast](#your-first-cast)
4. [Monitor Cast Status](#monitor-cast-status)
5. [Set Up Webhooks](#set-up-webhooks)
6. [Manage Your Budget](#manage-your-budget)

## Create an Account

1. Visit [your-domain.com](https://your-domain.com)
2. Click "Sign Up"
3. Sign in with GitHub or create an account with WebAuthn

## Generate an API Key

1. Go to your Profile page
2. Navigate to the "API Keys" section
3. Click "Create API Key"
4. Give your key a descriptive name (e.g., "Production Key")
5. **Save the key securely** - it will only be shown once

Your API key will look like: `sk_live_abc123...`

## Your First Cast

Let's cast your first spell using the API.

### Example: Convert a Document to PDF

```bash
curl -X POST https://your-domain.com/api/v1/cast \
  -H "Authorization: Bearer sk_live_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "spell_key": "pdf-converter",
    "input": {
      "file_url": "https://example.com/document.docx"
    }
  }'
```

**Response:**
```json
{
  "cast_id": "cast_abc123",
  "spell_key": "pdf-converter",
  "spell_name": "PDF Converter",
  "status": "running",
  "cost_cents": 299,
  "created_at": "2024-01-20T15:30:00Z",
  "message": "Cast initiated successfully"
}
```

## Monitor Cast Status

### Option 1: Polling

Poll the status endpoint to check progress:

```bash
curl https://your-domain.com/api/casts/cast_abc123
```

**Response when completed:**
```json
{
  "id": "cast_abc123",
  "status": "completed",
  "duration": 40000,
  "artifactUrl": "https://storage.example.com/output.pdf",
  "finishedAt": "2024-01-20T15:30:45Z"
}
```

### Option 2: Server-Sent Events (Real-time)

For real-time updates, use SSE:

```javascript
const eventSource = new EventSource(
  'https://your-domain.com/api/casts/cast_abc123/stream'
);

eventSource.addEventListener('status', (event) => {
  const data = JSON.parse(event.data);
  console.log('Status:', data.status);
});

eventSource.addEventListener('completed', (event) => {
  const data = JSON.parse(event.data);
  console.log('Result:', data.artifactUrl);
  eventSource.close();
});
```

## Set Up Webhooks

Webhooks notify your application when casts complete.

### 1. Configure Webhook URL

When creating a spell, set your webhook URL:

```bash
curl -X POST https://your-domain.com/api/spells/create \
  -H "Cookie: session=your_session" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Spell",
    "key": "my-spell",
    "description": "Description",
    "webhookUrl": "https://your-api.com/webhooks/spell",
    ...
  }'
```

### 2. Handle Webhook Requests

Create an endpoint to receive webhooks:

```javascript
// Express.js example
app.post('/webhooks/spell', express.json(), (req, res) => {
  const { event, cast } = req.body;

  if (event === 'cast.completed') {
    console.log(`Cast ${cast.id} completed!`);
    console.log(`Result: ${cast.artifactUrl}`);

    // Process the result
    // ...
  }

  res.status(200).send('OK');
});
```

### Webhook Payload

```json
{
  "event": "cast.completed",
  "timestamp": "2024-01-20T15:30:45Z",
  "cast": {
    "id": "cast_abc123",
    "spellId": "spell_123",
    "status": "completed",
    "duration": 40000,
    "costCents": 299,
    "artifactUrl": "https://storage.example.com/output.pdf",
    "createdAt": "2024-01-20T15:30:00Z",
    "finishedAt": "2024-01-20T15:30:45Z"
  }
}
```

## Manage Your Budget

Set monthly spending caps to control costs.

### Get Current Budget

```bash
curl https://your-domain.com/api/budget \
  -H "Cookie: session=your_session"
```

**Response:**
```json
{
  "monthlyCap": 100.0,
  "currentSpend": 45.50,
  "remaining": 54.50,
  "lastResetAt": "2024-01-01T00:00:00Z",
  "percentUsed": 45.5
}
```

### Update Budget Cap

```bash
curl -X PATCH https://your-domain.com/api/budget \
  -H "Cookie: session=your_session" \
  -H "Content-Type: application/json" \
  -d '{
    "monthlyCap": 200.0
  }'
```

## SDK Examples

### Node.js / TypeScript

```typescript
class SpellClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://your-domain.com/api') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async cast(spellKey: string, input: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/v1/cast`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ spell_key: spellKey, input }),
    });

    if (!response.ok) {
      throw new Error(`Cast failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async getStatus(castId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/casts/${castId}`);

    if (!response.ok) {
      throw new Error(`Failed to get status: ${response.statusText}`);
    }

    return await response.json();
  }

  async waitForCompletion(castId: string, pollInterval: number = 2000): Promise<any> {
    while (true) {
      const status = await this.getStatus(castId);

      if (status.status === 'completed') {
        return status;
      }

      if (status.status === 'failed') {
        throw new Error(`Cast failed: ${status.errorMessage}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
}

// Usage
const client = new SpellClient('sk_live_your_api_key');

const cast = await client.cast('pdf-converter', {
  file_url: 'https://example.com/document.docx'
});

console.log(`Cast initiated: ${cast.cast_id}`);

const result = await client.waitForCompletion(cast.cast_id);
console.log(`Completed! Result: ${result.artifactUrl}`);
```

### Python

```python
import requests
import time

class SpellClient:
    def __init__(self, api_key, base_url='https://your-domain.com/api'):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        }

    def cast(self, spell_key, input_data):
        response = requests.post(
            f'{self.base_url}/v1/cast',
            headers=self.headers,
            json={'spell_key': spell_key, 'input': input_data}
        )
        response.raise_for_status()
        return response.json()

    def get_status(self, cast_id):
        response = requests.get(f'{self.base_url}/casts/{cast_id}')
        response.raise_for_status()
        return response.json()

    def wait_for_completion(self, cast_id, poll_interval=2):
        while True:
            status = self.get_status(cast_id)

            if status['status'] == 'completed':
                return status

            if status['status'] == 'failed':
                raise Exception(f"Cast failed: {status.get('errorMessage')}")

            time.sleep(poll_interval)

# Usage
client = SpellClient('sk_live_your_api_key')

cast = client.cast('pdf-converter', {
    'file_url': 'https://example.com/document.docx'
})

print(f"Cast initiated: {cast['cast_id']}")

result = client.wait_for_completion(cast['cast_id'])
print(f"Completed! Result: {result['artifactUrl']}")
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```typescript
try {
  const cast = await client.cast('pdf-converter', input);
  // ...
} catch (error) {
  if (error.status === 429) {
    // Rate limited - implement exponential backoff
    await sleep(retryAfter * 1000);
  } else if (error.status === 400) {
    // Bad request - check input data
    console.error('Invalid input:', error.message);
  } else {
    // Other errors
    console.error('Unexpected error:', error);
  }
}
```

### 2. Rate Limit Handling

Respect rate limits and implement backoff:

```typescript
async function castWithRetry(client, spellKey, input, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.cast(spellKey, input);
    } catch (error) {
      if (error.status === 429) {
        const retryAfter = error.headers.get('Retry-After') || Math.pow(2, i);
        console.log(`Rate limited. Retrying in ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 3. Budget Monitoring

Check your budget before expensive operations:

```typescript
const budget = await client.getBudget();

if (budget.remaining < expectedCost) {
  throw new Error('Insufficient budget remaining');
}

// Proceed with cast
const cast = await client.cast(spellKey, input);
```

### 4. Secure API Keys

- **Never commit API keys** to version control
- Use environment variables: `process.env.SPELL_API_KEY`
- Rotate keys regularly
- Use separate keys for dev/staging/production

### 5. Webhook Security

- **Validate webhook source** (IP whitelist or signature verification - coming soon)
- **Idempotency**: Handle duplicate webhook deliveries
- **Return 200 quickly**: Process asynchronously if needed

## Troubleshooting

### Common Issues

**Issue: "Invalid or inactive API key"**
- Check your API key is correct
- Verify the key hasn't been revoked
- Ensure you're using the `Authorization: Bearer` format

**Issue: "Rate limit exceeded"**
- You're making too many requests
- Implement exponential backoff
- Consider upgrading your plan (coming soon)

**Issue: "Spell not found"**
- Check the spell_key is correct
- Verify the spell is published and active
- Use GET /api/spells to list available spells

**Issue: "Budget exceeded"**
- Your monthly cap has been reached
- Update your budget via PATCH /api/budget
- Wait for monthly reset (automatic)

## Next Steps

- [Complete API Reference](./API.md)
- [Create Your First Spell](./CREATE_SPELL.md) (coming soon)
- [Advanced Patterns](./ADVANCED.md) (coming soon)
- [FAQ](./FAQ.md) (coming soon)

## Support

Need help? Contact us:
- **Email**: support@spell-platform.com
- **GitHub**: [Issues](https://github.com/yourusername/spell-platform/issues)
- **Discord**: [Community Server](https://discord.gg/spell) (coming soon)
