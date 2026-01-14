const { spawn } = require('child_process');

/**
 * YouTube Service using yt-dlp + ffmpeg pipeline
 * Streams audio directly without saving to disk
 */

/**
 * Custom error class for YouTube download errors
 */
class YouTubeError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'YouTubeError';
  }
}

/**
 * Categorize yt-dlp error messages into user-friendly errors
 * @param {string} stderr - The stderr output from yt-dlp
 * @returns {YouTubeError} Categorized error with code and friendly message
 */
const categorizeError = (stderr) => {
  const errorText = stderr.toLowerCase();
  
  // Bot/verification check
  if (errorText.includes('sign in to confirm') || errorText.includes('not a bot')) {
    return new YouTubeError(
      'BOT_CHECK',
      'This video requires verification and cannot be downloaded. Please try another video.'
    );
  }
  
  // Video not available (removed, private, etc.)
  if (errorText.includes('not available') || errorText.includes('video unavailable')) {
    return new YouTubeError(
      'UNAVAILABLE',
      'This video is not available (removed, private, or restricted).'
    );
  }
  
  // Region/country restriction
  if (errorText.includes('not available in your country') || errorText.includes('geo')) {
    return new YouTubeError(
      'REGION_BLOCKED',
      'This video is not available in the server region.'
    );
  }
  
  // Age restriction
  if (errorText.includes('age') && (errorText.includes('restrict') || errorText.includes('verify'))) {
    return new YouTubeError(
      'AGE_RESTRICTED',
      'This video is age-restricted and requires login to download.'
    );
  }
  
  // Copyright/removed
  if (errorText.includes('copyright') || errorText.includes('removed')) {
    return new YouTubeError(
      'COPYRIGHT',
      'This video was removed due to copyright or other restrictions.'
    );
  }
  
  // Live stream
  if (errorText.includes('live') && errorText.includes('stream')) {
    return new YouTubeError(
      'LIVE_STREAM',
      'Live streams cannot be downloaded. Please try a regular video.'
    );
  }
  
  // Generic/unknown error
  return new YouTubeError(
    'UNKNOWN',
    'Failed to download this video. Please try another one.'
  );
};

/**
 * Get video information (title, duration, etc.)
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} Video information
 */
const getVideoInfo = (videoId) => {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    const ytdlp = spawn('yt-dlp', [
      '--dump-json',
      '--no-download',
      url
    ]);

    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
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
      reject(new Error(`yt-dlp not found or failed to start: ${err.message}`));
    });
  });
};

/**
 * Get direct audio stream URL from YouTube
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<string>} Direct audio URL
 */
const getAudioUrl = (videoId) => {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    const ytdlp = spawn('yt-dlp', [
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '--get-url',
      '--no-playlist',
      '--no-warnings',
      url
    ]);

    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp get-url error:', stderr);
        // Use categorized error for user-friendly messages
        reject(categorizeError(stderr));
        return;
      }

      const audioUrl = stdout.trim();
      if (!audioUrl) {
        reject(new YouTubeError('NO_URL', 'No audio URL returned from YouTube.'));
        return;
      }

      resolve(audioUrl);
    });

    ytdlp.on('error', (err) => {
      reject(new YouTubeError('YT_DLP_NOT_FOUND', `yt-dlp not found: ${err.message}`));
    });
  });
};

/**
 * Stream audio as MP3 using yt-dlp + ffmpeg pipeline
 * Stage 1: yt-dlp gets direct audio URL
 * Stage 2: ffmpeg converts to MP3 and streams to response
 * @param {string} videoId - YouTube video ID
 * @param {Object} res - Express response object
 * @param {string} filename - Filename for download
 * @returns {Promise<ChildProcess>} The ffmpeg process
 */
const streamAudio = async (videoId, res, filename) => {
  console.log(`Starting download: ${videoId}`);
  
  // Stage 1: Get direct audio URL from YouTube
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
  res.setHeader('Content-Disposition', `attachment; filename=${filename.replace(/\s/g, '_')}`);
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
  YouTubeError,
};
