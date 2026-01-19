const express = require('express');
const router = express.Router();
const apiKeyAuth = require('../middleware/auth');
const { searchMusic, fetchSongPage, getAudioUrl, streamAudio } = require('../services/bigaz');
const { sanitizeFilename } = require('../utils/helpers');

// Apply API key authentication to all routes
router.use(apiKeyAuth);

/**
 * GET /api/bigaz/search
 * Search for music on Big.az
 */
router.get('/search', async (req, res) => {
  const { query } = req.query;

  if (!query || !query.trim()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'query parameter is required'
    });
  }

  try {
    const result = await searchMusic(query.trim());
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Error searching Big.az:', err.message);
    res.status(500).json({
      error: 'Search failed',
      message: err.message
    });
  }
});

/**
 * GET /api/bigaz/song/:filename
 * Get song details from HTML page
 */
router.get('/song/:filename', async (req, res) => {
  const { filename } = req.params;

  if (!filename) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'filename parameter is required'
    });
  }

  try {
    const songData = await fetchSongPage(filename);
    res.json({
      success: true,
      data: songData
    });
  } catch (err) {
    console.error('Error fetching song page:', err.message);
    res.status(500).json({
      error: 'Failed to fetch song page',
      message: err.message
    });
  }
});

/**
 * GET /api/bigaz/audio/:songId
 * Get audio URL for a song
 */
router.get('/audio/:songId', async (req, res) => {
  const { songId } = req.params;
  const { lk, mh, mr, hs } = req.query;

  if (!songId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'songId parameter is required'
    });
  }

  try {
    const params = {};
    if (lk) params.lk = lk;
    if (mh) params.mh = mh;
    if (mr) params.mr = mr;
    if (hs) params.hs = hs;

    const audioUrl = await getAudioUrl(songId, params);
    res.json({
      success: true,
      data: {
        songId,
        audioUrl
      }
    });
  } catch (err) {
    console.error('Error getting audio URL:', err.message);
    res.status(500).json({
      error: 'Failed to get audio URL',
      message: err.message
    });
  }
});

/**
 * GET /api/bigaz/download/:songId
 * Stream audio file for download
 */
router.get('/download/:songId', async (req, res) => {
  const { songId } = req.params;
  const { title, artist, lk, mh, mr, hs } = req.query;

  if (!songId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'songId parameter is required'
    });
  }

  try {
    // Get audio URL
    const params = {};
    if (lk) params.lk = lk;
    if (mh) params.mh = mh;
    if (mr) params.mr = mr;
    if (hs) params.hs = hs;

    const audioUrl = await getAudioUrl(songId, params);

    // Generate filename
    let filename;
    if (title) {
      const fullTitle = artist ? `${artist} - ${title}` : title;
      filename = sanitizeFilename(fullTitle) + '.mp3';
    } else {
      filename = `bigaz-${songId}.mp3`;
    }

    // Stream audio
    await streamAudio(audioUrl, res, filename);

    // Handle client disconnect
    req.on('close', () => {
      // Cleanup if needed
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
