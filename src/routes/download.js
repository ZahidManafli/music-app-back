const express = require('express');
const router = express.Router();
const apiKeyAuth = require('../middleware/auth');
const { getVideoInfo, streamAudio, isValidVideoId } = require('../services/youtube');
const { sanitizeFilename } = require('../utils/helpers');

// Apply API key authentication to all routes
router.use(apiKeyAuth);

/**
 * GET /api/info
 * Get video information without downloading
 */
router.get('/info', async (req, res) => {
  const { videoId } = req.query;

  // Validate videoId
  if (!videoId) {
    return res.status(400).json({ 
      error: 'Bad Request',
      message: 'videoId query parameter is required'
    });
  }

  if (!isValidVideoId(videoId)) {
    return res.status(400).json({ 
      error: 'Bad Request',
      message: 'Invalid YouTube video ID format'
    });
  }

  try {
    const info = await getVideoInfo(videoId);
    res.json({
      success: true,
      data: info
    });
  } catch (err) {
    console.error('Error getting video info:', err.message);
    res.status(500).json({ 
      error: 'Failed to get video info',
      message: err.message
    });
  }
});

/**
 * GET /api/download
 * Stream audio as MP3 file download
 */
router.get('/download', async (req, res) => {
  const { videoId, title } = req.query;

  // Validate videoId
  if (!videoId) {
    return res.status(400).json({ 
      error: 'Bad Request',
      message: 'videoId query parameter is required'
    });
  }

  if (!isValidVideoId(videoId)) {
    return res.status(400).json({ 
      error: 'Bad Request',
      message: 'Invalid YouTube video ID format'
    });
  }

  try {
    // Get video info for filename if title not provided
    let filename;
    if (title) {
      filename = sanitizeFilename(title) + '.mp3';
    } else {
      try {
        const info = await getVideoInfo(videoId);
        filename = sanitizeFilename(info.title) + '.mp3';
      } catch {
        filename = `youtube-${videoId}.mp3`;
      }
    }

    // Stream audio to response (async - uses yt-dlp + ffmpeg pipeline)
    const process = await streamAudio(videoId, res, filename);

    // Handle client disconnect
    req.on('close', () => {
      if (process && !process.killed) {
        console.log('Client disconnected, killing ffmpeg process');
        process.kill('SIGTERM');
      }
    });

  } catch (err) {
    console.error('Download error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Download failed',
        message: err.message
      });
    }
  }
});

module.exports = router;
