const { spawn } = require('child_process');
const { getContentDisposition } = require('../utils/helpers');

/**
 * YouTube Service using yt-dlp
 * Streams audio directly without saving to disk
 */

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
 * Get the direct audio URL from YouTube using yt-dlp
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
        reject(new Error(`Failed to get audio URL: ${stderr || 'Unknown error'}`));
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
      reject(new Error(`yt-dlp not found: ${err.message}`));
    });
  });
};

/**
 * Stream audio as MP3 directly to response using ffmpeg
 * Uses a two-stage pipeline: yt-dlp gets URL, ffmpeg converts to MP3
 * @param {string} videoId - YouTube video ID
 * @param {Object} res - Express response object
 * @param {string} filename - Filename for download
 * @returns {Promise<ChildProcess>} The ffmpeg process
 */
const streamAudio = async (videoId, res, filename) => {
  console.log(`Starting download: ${videoId}`);
  
  try {
    // Step 1: Get direct audio URL from YouTube
    const audioUrl = await getAudioUrl(videoId);
    console.log(`Got audio URL for: ${videoId}`);

    // Step 2: Use ffmpeg to convert and stream to response
    const ffmpeg = spawn('ffmpeg', [
      '-i', audioUrl,           // Input from URL
      '-vn',                    // No video
      '-acodec', 'libmp3lame',  // MP3 codec
      '-ab', '192k',            // Bitrate
      '-f', 'mp3',              // Output format
      'pipe:1'                  // Output to stdout
    ]);

    // Set response headers for file download
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', getContentDisposition(filename));
    res.setHeader('Transfer-Encoding', 'chunked');

    // Pipe ffmpeg stdout directly to response
    ffmpeg.stdout.pipe(res);

    // Handle ffmpeg errors (stderr contains progress info, filter for real errors)
    ffmpeg.stderr.on('data', (data) => {
      const message = data.toString();
      if (message.includes('Error') || message.includes('error:')) {
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
  } catch (err) {
    console.error('Stream setup error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed', message: err.message });
    }
    throw err;
  }
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
