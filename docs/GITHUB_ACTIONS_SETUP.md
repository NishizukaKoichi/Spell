# GitHub Actions Integration Setup

This guide will help you set up GitHub Actions integration for the Spell Platform.

## Prerequisites

- A GitHub account with repository access
- Admin access to create a GitHub App
- A repository to install the GitHub App

## Step 1: Create a GitHub App

1. Go to GitHub Settings → Developer Settings → GitHub Apps → New GitHub App
2. Fill in the required fields:
   - **GitHub App name**: `Spell Platform` (or your preferred name)
   - **Homepage URL**: Your Spell Platform URL (e.g., `https://magicspell.io`)
   - **Webhook URL**: `https://your-domain.com/api/webhooks/github`
   - **Webhook secret**: Generate a secure random string

3. Set the following **Repository permissions**:
   - **Actions**: Read & write
   - **Contents**: Read (or Read & write if you need to create files)
   - **Metadata**: Read (automatically selected)

4. Subscribe to the following **Webhook events**:
   - **Workflow run**

5. Click **Create GitHub App**

## Step 2: Generate Private Key

1. After creating the app, scroll down to "Private keys"
2. Click **Generate a private key**
3. Download the `.pem` file
4. Convert the private key to a single-line format:

```bash
# On macOS/Linux
cat /path/to/your-app.2023-10-27.private-key.pem | tr '\n' '\\n'

# Or use this one-liner
awk '{printf "%s\\n", $0}' /path/to/your-app.2023-10-27.private-key.pem
```

## Step 3: Install the GitHub App

1. Go to your GitHub App settings page
2. Click **Install App** in the left sidebar
3. Select the account/organization where you want to install
4. Choose:
   - **All repositories**, or
   - **Only select repositories** (select the repository with your workflow)

5. Note the **Installation ID** from the URL after installation:
   - URL format: `https://github.com/settings/installations/{installation_id}`

## Step 4: Configure Environment Variables

Add the following to your `.env` file:

```env
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----"
GITHUB_APP_INSTALLATION_ID=12345678
GITHUB_REPOSITORY=owner/repo
GITHUB_WORKFLOW_FILE=spell-execution.yml
GITHUB_WORKFLOW_REF=main
GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
```

**Important:**

- `GITHUB_APP_PRIVATE_KEY`: Use the single-line format from Step 2
- `GITHUB_REPOSITORY`: Format is `owner/repo-name` (e.g., `microsoft/vscode`)
- `GITHUB_WEBHOOK_SECRET`: Must match the secret you set in Step 1

## Step 5: Create Workflow File

1. In your repository, create `.github/workflows/spell-execution.yml`
2. Copy the example workflow from this repository:
   - See `.github/workflows/spell-execution-example.yml`

3. Customize the workflow to execute your spell logic:

```yaml
- name: Execute Spell Logic
  run: |
    INPUT='${{ steps.parse.outputs.input_data }}'
    # Your spell execution here
    node scripts/execute-spell.js "$INPUT"
    # or: python scripts/execute.py "$INPUT"
```

4. Commit and push the workflow file

## Step 6: Test the Integration

### Method 1: Via API

```bash
curl -X POST http://localhost:3000/api/v1/cast \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "spell_key": "your-spell-key",
    "input": {
      "message": "Hello World"
    }
  }'
```

### Method 2: Via SSE (Real-time Progress)

```javascript
const castResponse = await fetch('/api/v1/cast', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    spell_key: 'your-spell-key',
    input: { message: 'Hello World' },
  }),
});

const { cast_id } = await castResponse.json();

// Subscribe to progress updates
const eventSource = new EventSource(`/api/v1/casts/${cast_id}/events`);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Status:', data.status);
  console.log('Progress:', data.progress);
  console.log('Message:', data.message);

  if (data.final) {
    eventSource.close();
  }
};
```

## Step 7: Verify Webhook Delivery

1. Go to your GitHub App settings
2. Click **Advanced** → **Recent Deliveries**
3. Verify that webhooks are being sent successfully
4. Check your Spell Platform logs for webhook processing

## Troubleshooting

### Webhook not received

1. Verify webhook URL is publicly accessible (use ngrok for local development)
2. Check webhook secret matches
3. Verify webhook signature validation

### Workflow not triggered

1. Verify GitHub App has Actions permission
2. Check workflow file path matches `GITHUB_WORKFLOW_FILE`
3. Verify branch matches `GITHUB_WORKFLOW_REF`

### Installation token errors

1. Verify `GITHUB_APP_ID` is correct
2. Check private key format (single-line with `\\n`)
3. Verify installation ID is correct

### Artifacts not found

1. Verify workflow uploads artifacts with `actions/upload-artifact@v4`
2. Check artifact retention period (default 7 days)
3. Verify artifact name matches expected pattern

## Architecture

```
User → POST /api/v1/cast
  ↓
Spell Platform
  ↓
1. Create Cast record (status: queued)
2. Trigger workflow_dispatch
3. Poll for run_id (5 seconds)
4. Update Cast (status: running)
5. Return cast_id + SSE URL
  ↓
GitHub Actions
  ↓
Workflow execution
  ↓
GitHub Webhook → POST /api/webhooks/github
  ↓
Spell Platform
  ↓
1. Verify signature
2. Update Cast status
3. Fetch artifacts (if succeeded)
4. Store artifact URL
```

## Advanced Configuration

### Using repository_dispatch

Instead of `workflow_dispatch`, you can use `repository_dispatch` for more flexibility:

```yaml
on:
  repository_dispatch:
    types: [spell.cast]
```

Trigger via API:

```typescript
import { triggerRepositoryDispatch } from '@/lib/github-app';

await triggerRepositoryDispatch('spell.cast', {
  cast_id: '...',
  spell_key: '...',
  input_data: JSON.stringify(input),
});
```

### Multiple Workflows

You can have different workflows for different spell types:

```env
# In your Spell metadata
SPELL_1_WORKFLOW=spell-image-processing.yml
SPELL_2_WORKFLOW=spell-data-analysis.yml
```

## Security Best Practices

1. **Webhook Secret**: Use a strong random string (32+ characters)
2. **Private Key**: Never commit to version control
3. **Permissions**: Grant minimum required permissions
4. **Token Caching**: Installation tokens are cached for ~1 hour
5. **Rate Limits**: GitHub API has rate limits (5000/hour for authenticated requests)

## Next Steps

- [ ] Set up monitoring for workflow failures
- [ ] Implement retry logic for transient errors
- [ ] Add metrics for execution time and success rate
- [ ] Configure alerts for webhook delivery failures

## Resources

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [Workflow Dispatch Event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch)
- [Repository Dispatch Event](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event)
- [Actions Artifacts API](https://docs.github.com/en/rest/actions/artifacts)
- [Webhook Events](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
