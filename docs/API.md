# Spell Platform API Documentation

Base URL: `https://your-domain.com/api`

## Authentication

### API Key Authentication
Include your API key in the `Authorization` header:
```
Authorization: Bearer sk_live_your_api_key_here
```

### Session Authentication
For web interface endpoints, authentication is handled via NextAuth sessions (cookies).

---

## Rate Limiting

- **Public API endpoints**: 60 requests per minute per API key/IP
- Rate limit headers are included in responses:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: When the rate limit resets (ISO 8601)
  - `Retry-After`: Seconds until you can retry (when rate limited)

---

## Endpoints

### Spells

#### List Spells
```http
GET /api/spells
```

**Query Parameters:**
- `search` (string, optional): Search spells by name/description
- `category` (string, optional): Filter by category
- `tags` (string, optional): Comma-separated tags
- `minPrice` (number, optional): Minimum price filter
- `maxPrice` (number, optional): Maximum price filter
- `priceModel` (string, optional): Filter by price model (`one_time` or `metered`)
- `sortBy` (string, optional): Sort field (`popularity`, `rating`, `newest`, `price-low`, `price-high`, `name`)

**Response:** `200 OK`
```json
{
  "spells": [
    {
      "id": "spell_123",
      "key": "pdf-converter",
      "name": "PDF Converter",
      "description": "Convert documents to PDF format",
      "priceModel": "one_time",
      "priceAmount": 2.99,
      "rating": 4.8,
      "totalCasts": 5678,
      "category": "document",
      "tags": ["pdf", "converter"],
      "status": "active"
    }
  ],
  "filters": {
    "categories": ["document", "ai", "image"],
    "tags": ["pdf", "ai", "converter"]
  }
}
```

#### Get Spell Details
```http
GET /api/spells/{id}
```

**Response:** `200 OK`
```json
{
  "id": "spell_123",
  "key": "pdf-converter",
  "name": "PDF Converter",
  "description": "Convert documents to PDF format",
  "longDescription": "Detailed description...",
  "version": "1.0.0",
  "priceModel": "one_time",
  "priceAmount": 2.99,
  "priceCurrency": "USD",
  "executionMode": "workflow",
  "category": "document",
  "rating": 4.8,
  "totalCasts": 5678,
  "tags": ["pdf", "converter"],
  "inputSchema": {},
  "outputSchema": {},
  "webhookUrl": "https://example.com/webhook",
  "status": "active",
  "author": {
    "id": "user_456",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-20T14:45:00Z"
}
```

#### Create Spell
```http
POST /api/spells/create
```

**Authentication:** Required (Session)

**Request Body:**
```json
{
  "name": "My New Spell",
  "key": "my-new-spell",
  "description": "A short description of the spell",
  "longDescription": "Detailed description (optional)",
  "category": "ai-ml",
  "priceModel": "metered",
  "priceAmount": 0.25,
  "executionMode": "workflow",
  "tags": ["ai", "nlp"],
  "webhookUrl": "https://example.com/webhook",
  "inputSchema": {},
  "outputSchema": {}
}
```

**Response:** `201 Created`
```json
{
  "id": "spell_789",
  "key": "my-new-spell",
  "name": "My New Spell",
  "status": "active"
}
```

#### Update Spell
```http
PATCH /api/spells/{id}
```

**Authentication:** Required (Session, must be author)

**Request Body:** (all fields optional)
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "priceAmount": 1.99,
  "status": "inactive",
  "webhookUrl": "https://new-webhook.com"
}
```

**Response:** `200 OK`

#### Delete Spell
```http
DELETE /api/spells/{id}
```

**Authentication:** Required (Session, must be author)

**Response:** `200 OK`
```json
{
  "message": "Spell deleted"
}
```

**Note:** If the spell has existing casts, it will be soft deleted (status set to `inactive`) instead of hard deleted.

---

### Casts

#### Cast a Spell (API)
```http
POST /api/v1/cast
```

**Authentication:** Required (API Key)

**Headers:**
```
Authorization: Bearer sk_live_your_api_key
Content-Type: application/json
```

**Request Body:**
```json
{
  "spell_key": "pdf-converter",
  "input": {
    "file_url": "https://example.com/document.docx",
    "format": "pdf"
  }
}
```

**Response:** `201 Created`
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

#### Get Cast Status
```http
GET /api/casts/{id}
```

**Response:** `200 OK`
```json
{
  "id": "cast_abc123",
  "spellId": "spell_123",
  "status": "completed",
  "startedAt": "2024-01-20T15:30:05Z",
  "finishedAt": "2024-01-20T15:30:45Z",
  "duration": 40000,
  "costCents": 299,
  "artifactUrl": "https://storage.example.com/output.pdf",
  "spell": {
    "id": "spell_123",
    "name": "PDF Converter"
  },
  "caster": {
    "id": "user_456",
    "name": "John Doe"
  }
}
```

#### List User Casts
```http
GET /api/casts
```

**Authentication:** Required (Session)

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Results per page (default: 20, max: 100)

**Response:** `200 OK`
```json
{
  "casts": [
    {
      "id": "cast_abc123",
      "status": "completed",
      "duration": 40000,
      "costCents": 299,
      "spell": {
        "id": "spell_123",
        "name": "PDF Converter"
      },
      "createdAt": "2024-01-20T15:30:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20
  }
}
```

#### Stream Cast Status (SSE)
```http
GET /api/casts/{id}/stream
```

**Response:** Server-Sent Events stream
```
event: status
data: {"status":"running","progress":25}

event: status
data: {"status":"running","progress":75}

event: completed
data: {"status":"completed","artifactUrl":"https://..."}
```

---

### Reviews

#### Create Review
```http
POST /api/reviews
```

**Authentication:** Required (Session)

**Request Body:**
```json
{
  "castId": "cast_abc123",
  "rating": 5,
  "comment": "Excellent spell, worked perfectly!"
}
```

**Response:** `201 Created`
```json
{
  "id": "review_xyz",
  "castId": "cast_abc123",
  "spellId": "spell_123",
  "userId": "user_456",
  "rating": 5,
  "comment": "Excellent spell, worked perfectly!",
  "createdAt": "2024-01-20T16:00:00Z"
}
```

#### List Reviews for Spell
```http
GET /api/reviews?spellId={spellId}
```

**Response:** `200 OK`
```json
{
  "reviews": [
    {
      "id": "review_xyz",
      "rating": 5,
      "comment": "Excellent spell!",
      "user": {
        "id": "user_456",
        "name": "John Doe"
      },
      "createdAt": "2024-01-20T16:00:00Z"
    }
  ]
}
```

---

### Budget

#### Get Budget
```http
GET /api/budget
```

**Authentication:** Required (Session)

**Response:** `200 OK`
```json
{
  "monthlyCap": 100.0,
  "currentSpend": 45.50,
  "remaining": 54.50,
  "lastResetAt": "2024-01-01T00:00:00Z",
  "percentUsed": 45.5
}
```

#### Update Budget Cap
```http
PATCH /api/budget
```

**Authentication:** Required (Session)

**Request Body:**
```json
{
  "monthlyCap": 200.0
}
```

**Response:** `200 OK`
```json
{
  "monthlyCap": 200.0,
  "currentSpend": 45.50,
  "remaining": 154.50
}
```

---

### API Keys

#### List API Keys
```http
GET /api/keys
```

**Authentication:** Required (Session)

**Response:** `200 OK`
```json
{
  "keys": [
    {
      "id": "key_abc",
      "name": "Production Key",
      "key": "sk_live_abc123...",
      "status": "active",
      "lastUsedAt": "2024-01-20T15:30:00Z",
      "createdAt": "2024-01-01T10:00:00Z"
    }
  ]
}
```

#### Create API Key
```http
POST /api/keys
```

**Authentication:** Required (Session)

**Request Body:**
```json
{
  "name": "My New Key"
}
```

**Response:** `201 Created`
```json
{
  "id": "key_xyz",
  "name": "My New Key",
  "key": "sk_live_xyz789...",
  "status": "active",
  "createdAt": "2024-01-20T16:30:00Z"
}
```

**⚠️ Important:** Save this key securely. It will only be shown once.

#### Revoke API Key
```http
DELETE /api/keys/{id}
```

**Authentication:** Required (Session)

**Response:** `200 OK`
```json
{
  "message": "API key revoked"
}
```

---

### Stats

#### Get User Statistics
```http
GET /api/stats
```

**Authentication:** Required (Session)

**Response:** `200 OK`
```json
{
  "totalCasts": 150,
  "totalSpent": 45.50,
  "spellsCreated": 5,
  "averageRating": 4.7,
  "thisMonth": {
    "casts": 32,
    "spent": 12.75
  }
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

### Status Codes

- `200 OK`: Request succeeded
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required or failed
- `403 Forbidden`: Authenticated but not authorized
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## Webhooks

When you configure a webhook URL for your spell, we'll send POST requests to that URL when casts complete.

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

### Webhook Headers

```
Content-Type: application/json
User-Agent: Spell-Platform-Webhook/1.0
X-Spell-Event: cast.completed
X-Spell-Cast-ID: cast_abc123
X-Spell-Delivery-Attempt: 1
```

### Retry Policy

- Webhooks are retried up to 3 times on failure
- Exponential backoff: 2s, 4s, 8s between retries
- 10 second timeout per request
- 4xx errors are not retried

---

## SDK Examples

### Node.js

```javascript
const SPELL_API_KEY = 'sk_live_your_api_key';
const BASE_URL = 'https://your-domain.com/api';

async function castSpell(spellKey, input) {
  const response = await fetch(`${BASE_URL}/v1/cast`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SPELL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      spell_key: spellKey,
      input: input,
    }),
  });

  if (!response.ok) {
    throw new Error(`Cast failed: ${response.statusText}`);
  }

  return await response.json();
}

// Usage
const result = await castSpell('pdf-converter', {
  file_url: 'https://example.com/doc.docx'
});

console.log(`Cast ID: ${result.cast_id}`);
console.log(`Status: ${result.status}`);
```

### Python

```python
import requests

SPELL_API_KEY = 'sk_live_your_api_key'
BASE_URL = 'https://your-domain.com/api'

def cast_spell(spell_key, input_data):
    response = requests.post(
        f'{BASE_URL}/v1/cast',
        headers={
            'Authorization': f'Bearer {SPELL_API_KEY}',
            'Content-Type': 'application/json',
        },
        json={
            'spell_key': spell_key,
            'input': input_data,
        }
    )
    response.raise_for_status()
    return response.json()

# Usage
result = cast_spell('pdf-converter', {
    'file_url': 'https://example.com/doc.docx'
})

print(f"Cast ID: {result['cast_id']}")
print(f"Status: {result['status']}")
```

### cURL

```bash
curl -X POST https://your-domain.com/api/v1/cast \
  -H "Authorization: Bearer sk_live_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "spell_key": "pdf-converter",
    "input": {
      "file_url": "https://example.com/doc.docx"
    }
  }'
```

---

## Best Practices

1. **Store API keys securely**: Never commit keys to version control
2. **Handle rate limits**: Implement exponential backoff when rate limited
3. **Verify webhook signatures**: Coming soon - webhook signature verification
4. **Poll for status**: Use GET /api/casts/{id} to check cast status
5. **Set budgets**: Configure monthly spending caps to avoid surprises
6. **Use SSE for real-time updates**: Stream cast status for real-time progress
7. **Handle errors gracefully**: All APIs return consistent error formats
8. **Monitor your usage**: Check /api/stats regularly

---

## Support

For API support, please contact support@spell-platform.com or open an issue on GitHub.
