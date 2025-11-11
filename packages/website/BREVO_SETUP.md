# Brevo Email Service Setup

The waitlist feature requires Brevo (formerly Sendinblue) API configuration to collect and manage email signups.

## Quick Setup

### 1. Get Brevo API Key

1. Sign up at [https://www.brevo.com/](https://www.brevo.com/)
2. Navigate to **Settings** → **SMTP & API** → **API Keys**
3. Create a new API key with the name "Truxe Website Waitlist"
4. Copy the generated API key

### 2. Create Contact List

1. Go to **Contacts** → **Lists**
2. Click **Create a new list**
3. Name it "Truxe Waitlist"
4. Note the List ID (visible in the URL or list details)

### 3. Configure Custom Attributes (Optional but Recommended)

To store additional information about signups:

1. Go to **Contacts** → **Settings** → **Contact attributes**
2. Create the following attributes:
   - `COMPANY` (Text)
   - `USE_CASE` (Text)
   - `SOURCE` (Text)

### 4. Set Environment Variables

Add these to your production environment (Vercel, Netlify, etc.):

```bash
BREVO_API_KEY=xkeysib-your-api-key-here
BREVO_LIST_ID=2
```

For local development, create a `.env.local` file:

```bash
# Copy from .env.example
cp .env.example .env.local

# Then edit .env.local with your actual values
BREVO_API_KEY=xkeysib-your-actual-key
BREVO_LIST_ID=2
```

## Vercel Deployment

If deploying to Vercel:

```bash
# Add environment variables via CLI
vercel env add BREVO_API_KEY
vercel env add BREVO_LIST_ID

# Or via dashboard:
# Project Settings → Environment Variables
```

## Testing

### Local Testing

```bash
# Start the development server
pnpm dev

# Navigate to http://localhost:3000/#waitlist
# Fill out and submit the form
```

### Production Testing

```bash
# Test the deployed API endpoint
curl -X POST https://truxe.io/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "company": "Test Company",
    "useCase": "saas"
  }'
```

Expected response:
```json
{"success": true}
```

## Error Handling

The API will handle missing configuration gracefully:

- **Development mode**: Logs to console instead of sending to Brevo
- **Production mode**: Returns 503 error with user-friendly message

## Security Notes

- API keys should NEVER be committed to git
- Always use environment variables
- The `.env.local` file is gitignored by default
- API keys should have minimal required permissions

## Monitoring

Check Brevo dashboard regularly:
- **Contacts** → **Lists** → View your waitlist
- **Statistics** → API usage and rate limits
- **Logs** → Recent API calls

## Troubleshooting

### 500 Error: "Service temporarily unavailable"

**Cause**: Environment variables not set in production

**Fix**:
1. Verify `BREVO_API_KEY` and `BREVO_LIST_ID` are set
2. Redeploy the application
3. Check deployment logs for Brevo-related errors

### 400 Error: Invalid API Key

**Cause**: Incorrect or expired API key

**Fix**:
1. Generate a new API key in Brevo dashboard
2. Update the `BREVO_API_KEY` environment variable
3. Redeploy

### Contacts Not Appearing in List

**Cause**: Wrong `BREVO_LIST_ID` or list doesn't exist

**Fix**:
1. Verify the list ID in Brevo dashboard (check the URL when viewing the list)
2. Ensure the list is not archived or deleted
3. Update `BREVO_LIST_ID` and redeploy

### Rate Limiting

Brevo free tier limits:
- 300 emails/day
- 9,000 emails/month
- API rate limit: varies by plan

**Solution**: Upgrade to a paid plan if needed

## Alternative: Disable Brevo (Not Recommended for Production)

If you want to deploy without email collection temporarily:

1. The API will log signups to console in development mode
2. In production, it will return a 503 error
3. Consider setting up a temporary database storage instead

## Support

- Brevo Documentation: [https://developers.brevo.com/](https://developers.brevo.com/)
- Truxe Issues: [https://github.com/your-org/truxe/issues](https://github.com/your-org/truxe/issues)
