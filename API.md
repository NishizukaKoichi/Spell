# Spell Platform API Documentation

## Authentication

The Spell Platform API uses API keys for authentication. You can manage your API keys in the [Profile page](https://magicspell.io/profile).

### API Key Format

```
sk_live_<random_32_bytes_base64url>
```

## Endpoints

### Cast a Spell

Execute a spell using your API key.

**Endpoint:** `POST /api/v1/cast`

**Headers:**
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Request Body:**
```json
{
  "spell_key": "image-resize",
  "input": {
    "width": 800,
    "height": 600
  }
}
```

**Response (201 Created):**
```json
{
  "cast_id": "clxxxxx",
  "spell_key": "image-resize",
  "spell_name": "Image Resizer",
  "status": "queued",
  "cost_cents": 50,
  "created_at": "2025-10-27T12:00:00.000Z",
  "message": "Cast initiated successfully"
}
```

**Error Responses:**

- `401 Unauthorized` - Missing or invalid API key
- `404 Not Found` - Spell not found
- `400 Bad Request` - Invalid request body or inactive spell
- `500 Internal Server Error` - Server error

## Examples

### cURL

```bash
curl -X POST https://magicspell.io/api/v1/cast \
  -H "Authorization: Bearer sk_live_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "spell_key": "image-resize",
    "input": {
      "width": 800,
      "height": 600
    }
  }'
```

### JavaScript (fetch)

```javascript
const response = await fetch('https://magicspell.io/api/v1/cast', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    spell_key: 'image-resize',
    input: {
      width: 800,
      height: 600,
    },
  }),
});

const data = await response.json();
console.log(data);
```

### Python (requests)

```python
import requests

response = requests.post(
    'https://magicspell.io/api/v1/cast',
    headers={
        'Authorization': 'Bearer sk_live_YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'spell_key': 'image-resize',
        'input': {
            'width': 800,
            'height': 600,
        },
    }
)

data = response.json()
print(data)
```

## Rate Limits

- Maximum 5 active API keys per account
- No rate limit on API requests (subject to change)

## Best Practices

1. **Keep your API keys secure** - Never commit them to version control
2. **Use environment variables** - Store API keys in environment variables
3. **Rotate keys regularly** - Delete old keys and create new ones periodically
4. **Monitor usage** - Check the "Last Used" timestamp in your profile
5. **Use descriptive names** - Name your keys based on their purpose (e.g., "Production", "Development")

## Security

- API keys are hashed and stored securely
- Keys are only shown in full once during creation
- API key validation updates the "last used" timestamp
- Inactive keys are automatically rejected

## Troubleshooting

### "Invalid or inactive API key"

- Verify the API key is correct (no extra spaces)
- Check if the key has been deleted
- Ensure you're using the `Bearer` authentication scheme

### "Spell not found"

- Verify the `spell_key` is correct
- Check if the spell is active

### "Failed to trigger spell execution"

- This indicates a server-side issue with GitHub Actions
- Contact support if the issue persists
