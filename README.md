# Music App Backend

A Node.js backend service that streams YouTube audio as MP3 files using yt-dlp. Audio is streamed directly to the client without being saved on the server.

## Features

- Stream YouTube audio as MP3
- No server-side storage (direct streaming)
- API key authentication
- CORS support for frontend integration
- Ready for Railway deployment

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check | No |
| GET | `/api/info?videoId=xxx` | Get video info | Yes |
| GET | `/api/download?videoId=xxx` | Download MP3 | Yes |

### Authentication

All `/api/*` endpoints require the `x-api-key` header:

```bash
curl -H "x-api-key: your-api-key" "https://your-app.up.railway.app/api/info?videoId=dQw4w9WgXcQ"
```

### Example Responses

**GET /api/info?videoId=dQw4w9WgXcQ**
```json
{
  "success": true,
  "data": {
    "id": "dQw4w9WgXcQ",
    "title": "Video Title",
    "duration": 212,
    "channel": "Channel Name",
    "thumbnail": "https://...",
    "viewCount": 1234567
  }
}
```

**GET /api/download?videoId=dQw4w9WgXcQ**
- Returns: MP3 audio stream
- Headers: `Content-Type: audio/mpeg`, `Content-Disposition: attachment`

## Local Development

### Prerequisites

- Node.js 18+
- yt-dlp installed (`pip install yt-dlp`)
- ffmpeg installed

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   cd music-app-back
   npm install
   ```

3. Create `.env` file:
   ```env
   PORT=3000
   API_KEY=your-secret-api-key-here
   ALLOWED_ORIGINS=http://localhost:5173
   ```

4. Start the server:
   ```bash
   npm start
   ```

5. Test the health endpoint:
   ```bash
   curl http://localhost:3000/health
   ```

## Railway Deployment

### Step 1: Push to GitHub

1. Create a new GitHub repository
2. Push your code:
   ```bash
   cd music-app-back
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/music-app-back.git
   git push -u origin main
   ```

### Step 2: Create Railway Project

1. Go to [Railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your `music-app-back` repository
5. Railway will automatically detect the Node.js project

### Step 3: Configure Environment Variables

In Railway dashboard, go to your project and click **"Variables"** tab:

| Variable | Value | Description |
|----------|-------|-------------|
| `API_KEY` | `your-secret-key` | API key for authentication (generate a strong random string) |
| `ALLOWED_ORIGINS` | `https://your-frontend-url.com` | Frontend URL(s), comma-separated |
| `PORT` | `3000` | Server port (Railway sets this automatically) |

**Generate a secure API key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4: Deploy

1. Railway will automatically deploy when you push to GitHub
2. Click **"Settings"** → **"Networking"** → **"Generate Domain"** to get your public URL
3. Your backend will be available at: `https://your-app.up.railway.app`

### Step 5: Test Deployment

```bash
# Health check
curl https://your-app.up.railway.app/health

# Get video info
curl -H "x-api-key: your-api-key" \
  "https://your-app.up.railway.app/api/info?videoId=dQw4w9WgXcQ"

# Download audio (saves to file)
curl -H "x-api-key: your-api-key" \
  "https://your-app.up.railway.app/api/download?videoId=dQw4w9WgXcQ" \
  -o audio.mp3
```

## Frontend Integration

Add these environment variables to your frontend `.env`:

```env
VITE_YOUTUBE_BACKEND_URL=https://your-app.up.railway.app
VITE_YOUTUBE_BACKEND_API_KEY=your-api-key
```

Example frontend code:

```javascript
const downloadYouTubeAudio = async (videoId, title) => {
  const response = await fetch(
    `${import.meta.env.VITE_YOUTUBE_BACKEND_URL}/api/download?videoId=${videoId}&title=${encodeURIComponent(title)}`,
    {
      headers: {
        'x-api-key': import.meta.env.VITE_YOUTUBE_BACKEND_API_KEY
      }
    }
  );
  
  if (!response.ok) {
    throw new Error('Download failed');
  }
  
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.mp3`;
  a.click();
  URL.revokeObjectURL(url);
};
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `API_KEY` | Yes | - | API key for authentication |
| `ALLOWED_ORIGINS` | No | `localhost` | Comma-separated list of allowed origins |

## Troubleshooting

### "yt-dlp not found"
Make sure yt-dlp is installed on the server. Railway's Nixpacks should handle this automatically.

### CORS errors
Add your frontend URL to `ALLOWED_ORIGINS` environment variable.

### Download fails
- Check if the video is available in your region
- Verify the video ID is correct (11 characters)
- Check Railway logs for error details

## License

MIT
