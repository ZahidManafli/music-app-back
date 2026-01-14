# Music App Backend

A Node.js backend service that streams YouTube audio as MP3 files using yt-dlp. Audio is streamed directly to the client without being saved on the server.

## Features

- Stream YouTube audio as MP3
- No server-side storage (direct streaming)
- API key authentication
- CORS support for frontend integration
- Ready for Render.com deployment

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check | No |
| GET | `/api/info?videoId=xxx` | Get video info | Yes |
| GET | `/api/download?videoId=xxx` | Download MP3 | Yes |

### Authentication

All `/api/*` endpoints require the `x-api-key` header:

```bash
curl -H "x-api-key: your-api-key" "https://your-app.onrender.com/api/info?videoId=dQw4w9WgXcQ"
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

## Render.com Deployment

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

### Step 2: Create Render Account

1. Go to [render.com](https://render.com) and sign up (free)
2. Connect your GitHub account

### Step 3: Deploy Web Service

1. Click **"New +"** > **"Web Service"**
2. Connect your `music-app-back` repository
3. Configure the service:
   - **Name**: `music-app-back`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Runtime**: `Docker`
   - **Plan**: `Free`

4. Click **"Create Web Service"**

### Step 4: Configure Environment Variables

In the Render dashboard, go to your service > **"Environment"** tab:

| Variable | Value | Description |
|----------|-------|-------------|
| `API_KEY` | `your-secret-key` | API key for authentication |
| `ALLOWED_ORIGINS` | `https://your-frontend.com` | Frontend URL(s), comma-separated |

**Generate a secure API key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5: Get Your URL

After deployment completes, your backend will be available at:
```
https://music-app-back.onrender.com
```
(The actual URL will be shown in your Render dashboard)

### Step 6: Test Deployment

```bash
# Health check
curl https://your-app.onrender.com/health

# Get video info
curl -H "x-api-key: your-api-key" \
  "https://your-app.onrender.com/api/info?videoId=dQw4w9WgXcQ"

# Download audio (saves to file)
curl -H "x-api-key: your-api-key" \
  "https://your-app.onrender.com/api/download?videoId=dQw4w9WgXcQ" \
  -o audio.mp3
```

## One-Click Deploy (Blueprint)

You can also deploy using the Render Blueprint:

1. Fork this repository
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click **"New +"** > **"Blueprint"**
4. Connect your forked repository
5. Render will read `render.yaml` and set up everything automatically
6. Enter values for `API_KEY` and `ALLOWED_ORIGINS` when prompted

## Frontend Integration

Add these environment variables to your frontend `.env`:

```env
VITE_YOUTUBE_BACKEND_URL=https://your-app.onrender.com
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

## Render Free Tier Notes

- **750 free hours/month** - enough for a personal project
- **Spins down after 15 min inactivity** - first request after idle may take ~30s
- **No credit card required** for free tier

## Troubleshooting

### "Service unavailable" or slow first request
- Free tier services spin down after inactivity
- First request after idle takes ~30 seconds to spin up
- This is normal for free tier

### CORS errors
- Add your frontend URL to `ALLOWED_ORIGINS` environment variable
- Use `*` for testing (not recommended for production)

### Download fails or times out
- Check if the video is available in your region
- Verify the video ID is correct (11 characters)
- Check Render logs for error details

### yt-dlp errors
- The Docker container includes yt-dlp and ffmpeg
- If issues persist, check Render logs for specific errors

## License

MIT
