const { spawn } = require('child_process');

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
 * Stream audio as MP3 directly to response
 * @param {string} videoId - YouTube video ID
 * @param {Object} res - Express response object
 * @param {string} filename - Filename for download
 * @returns {ChildProcess} The yt-dlp process
 */
const streamAudio = (videoId, res, filename) => {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  
  // yt-dlp arguments for streaming audio
  const args = [
    '-f', 'bestaudio[ext=m4a]/bestaudio',  // Best audio format
    '-x',                                    // Extract audio
    '--audio-format', 'mp3',                 // Convert to MP3
    '--audio-quality', '0',                  // Best quality
    '-o', '-',                               // Output to stdout
    '--no-playlist',                         // Don't download playlists
    '--no-warnings',                         // Suppress warnings
    url
  ];

  console.log(`Starting download: ${videoId}`);
  
  const ytdlp = spawn('yt-dlp', args);

  // Set response headers for file download
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Transfer-Encoding', 'chunked');

  // Pipe yt-dlp stdout directly to response
  ytdlp.stdout.pipe(res);

  // Handle errors
  ytdlp.stderr.on('data', (data) => {
    const message = data.toString();
    // Only log actual errors, not progress messages
    if (message.includes('ERROR') || message.includes('error')) {
      console.error('yt-dlp stderr:', message);
    }
  });

  ytdlp.on('error', (err) => {
    console.error('yt-dlp process error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed', message: err.message });
    }
  });

  ytdlp.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`yt-dlp exited with code ${code}`);
    } else {
      console.log(`Download completed: ${videoId}`);
    }
  });

  return ytdlp;
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
  streamAudio,
  isValidVideoId,
};
