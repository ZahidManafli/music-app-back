const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * YouTube Service using yt-dlp + ffmpeg pipeline
 * Supports cookie-based authentication for bot detection bypass
 * Streams audio directly without saving to disk
 */

/**
 * Write YouTube cookies from environment variable to temp file
 * @returns {string|null} Path to temp cookie file, or null if no cookies configured
 */
const writeCookiesFile = () => {
  if (!process.env.YOUTUBE_COOKIES) {
    return null; // No cookies configured
  }
  const cookiePath = path.join(os.tmpdir(), `yt-cookies-${Date.now()}.txt`);
  fs.writeFileSync(cookiePath, process.env.YOUTUBE_COOKIES);
  return cookiePath;
};

/**
 * Clean up temporary cookies file
 * @param {string} cookiePath - Path to the temp cookie file
 */
const cleanupCookiesFile = (cookiePath) => {
  if (cookiePath && fs.existsSync(cookiePath)) {
    fs.unlinkSync(cookiePath);
  }
};

/**
 * Get video information (title, duration, etc.)
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} Video information
 */
const getVideoInfo = (videoId) => {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const cookiePath = writeCookiesFile();
    
    const args = ['--dump-json', '--no-download'];
    if (cookiePath) {
      args.push('--cookies', cookiePath);
    }
    args.push(url);
    
    const ytdlp = spawn('yt-dlp', args);

    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
      cleanupCookiesFile(cookiePath);
      
      if (code !== 0) {
        console.error('yt-dlp error:', stderr);
        reject(new Error(`Failed to get video info: ${stderr || 'Unknown error'}`));
        return;
      }

      try {
        const info = JSON.parse(stdout);
        resolve({
          id: info.id,
          title: info.title,
          duration: info.duration,
          channel: info.channel || info.uploader,
          thumbnail: info.thumbnail,
          description: info.description?.substring(0, 200),
          viewCount: info.view_count,
          uploadDate: info.upload_date,
        });
      } catch (err) {
        reject(new Error('Failed to parse video info'));
      }
    });

    ytdlp.on('error', (err) => {
      cleanupCookiesFile(cookiePath);
      reject(new Error(`yt-dlp not found or failed to start: ${err.message}`));
    });
  });
};

/**
 * Get direct audio stream URL from YouTube using yt-dlp
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<string>} Direct audio URL
 */
const getAudioUrl = (videoId) => {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const cookiePath = writeCookiesFile();
    
    const args = ['-f', 'bestaudio', '--get-url', '--no-playlist'];
    if (cookiePath) {
      args.push('--cookies', cookiePath);
    }
    args.push(url);
    
    const ytdlp = spawn('yt-dlp', args);

    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
      cleanupCookiesFile(cookiePath);
      
      if (code !== 0) {
        console.error('yt-dlp get-url error:', stderr);
        reject(new Error(stderr || 'Failed to get audio URL'));
        return;
      }

      const audioUrl = stdout.trim();
      if (!audioUrl) {
        reject(new Error('No audio URL returned'));
        return;
      }

      resolve(audioUrl);
    });

    ytdlp.on('error', (err) => {
      cleanupCookiesFile(cookiePath);
      reject(new Error(`yt-dlp not found: ${err.message}`));
    });
  });
};

/**
 * Stream audio as MP3 using yt-dlp + ffmpeg pipeline
 * Stage 1: yt-dlp gets direct audio URL (with cookies for auth)
 * Stage 2: ffmpeg converts to MP3 and streams to response
 * @param {string} videoId - YouTube video ID
 * @param {Object} res - Express response object
 * @param {string} filename - Filename for download
 * @returns {Promise<ChildProcess>} The ffmpeg process
 */
const streamAudio = async (videoId, res, filename) => {
  console.log(`Starting download: ${videoId}`);
  
  // Stage 1: Get direct audio URL from YouTube (with cookies)
  const audioUrl = await getAudioUrl(videoId);
  console.log(`Got audio URL for: ${videoId}`);

  // Stage 2: Use ffmpeg to convert and stream MP3
  const ffmpeg = spawn('ffmpeg', [
    '-i', audioUrl,           // Input from URL
    '-vn',                    // No video
    '-acodec', 'libmp3lame',  // MP3 codec
    '-ab', '192k',            // 192kbps bitrate
    '-f', 'mp3',              // Output format
    'pipe:1'                  // Output to stdout
  ]);

  // Set response headers for file download
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Transfer-Encoding', 'chunked');

  // Pipe ffmpeg stdout directly to response
  ffmpeg.stdout.pipe(res);

  // Handle ffmpeg stderr (contains progress info, filter for real errors)
  ffmpeg.stderr.on('data', (data) => {
    const message = data.toString();
    if (message.includes('Error') || message.includes('error:') || message.includes('Invalid')) {
      console.error('ffmpeg error:', message);
    }
  });

  ffmpeg.on('error', (err) => {
    console.error('ffmpeg process error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed', message: err.message });
    }
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`ffmpeg exited with code ${code}`);
    } else {
      console.log(`Download completed: ${videoId}`);
    }
  });

  return ffmpeg;
};

/**
 * Validate YouTube video ID format
 * @param {string} videoId - Video ID to validate
 * @returns {boolean} True if valid
 */
const isValidVideoId = (videoId) => {
  // YouTube video IDs are 11 characters, alphanumeric with - and _
  const pattern = /^[a-zA-Z0-9_-]{11}$/;
  return pattern.test(videoId);
};

module.exports = {
  getVideoInfo,
  getAudioUrl,
  streamAudio,
  isValidVideoId,
};
