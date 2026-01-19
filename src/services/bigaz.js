const fetch = (...args) => require('node-fetch')(...args);
const cheerio = require('cheerio');

const BASE_URL = 'https://analytics.google.com/g/collect';
const SEARCH_BASE_URL = 'https://mp3.big.az/search/';
const SONG_BASE_URL = 'https://mp3.big.az/';
const AJAX_BASE_URL = 'https://mp3.big.az/ajax.php';

const COMMON_QUERY = {
  v: '2',
  tid: 'G-YGSD0X5QC5',
  gtm: '45je61e1v9104750508z89120884388za20gzb9120884388zd9120884388',
  _p: '1768842632288',
  gcd: '13l3l3l3l1l1',
  npa: '0',
  dma: '0',
  cid: '2020516668.1768345239',
  ul: 'en-us',
  sr: '1536x864',
  uaa: 'x86',
  uab: '64',
  uafvl: 'Not(A%253ABrand%3B8.0.0.0%7CChromium%3B144.0.7559.60%7CGoogle%2520Chrome%3B144.0.7559.60',
  uamb: '0',
  uam: '',
  uap: 'Windows',
  uapv: '10.0.0',
  uaw: '0',
  are: '1',
  frm: '0',
  pscdl: 'noapi',
  _eu: 'AAAAAGQ',
  _s: '1',
  tag_exp: '103116026~103200004~104527906~104528501~104684208~104684211~105391253~115938465~115938469~116682875~117041587',
  sid: '1768842553',
  sct: '7',
  seg: '1',
  dl: 'https://mp3.big.az/search/',
  dr: 'https://mp3.big.az/',
  en: 'page_view',
  tfd: '9217'
};

const COMMON_HEADERS = {
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.9,ru;q=0.8,az;q=0.7',
  'origin': 'https://mp3.big.az',
  'priority': 'u=1, i',
  'referer': 'https://mp3.big.az/',
  'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'no-cors',
  'sec-fetch-site': 'cross-site',
  'sec-fetch-storage-access': 'active',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'x-browser-channel': 'stable',
  'x-browser-copyright': 'Copyright 2026 Google LLC. All Rights reserved.',
  'x-browser-validation': 'PHzxKQDW1JU+MpcuUrBanuCqlLI=',
  'x-browser-year': '2026',
  'x-client-data': 'CI62yQEIpbbJAQipncoBCJmAywEIkqHLAQiFoM0BCJGkzwEIyKbPAQ==',
};

const SEARCH_HEADERS = {
  ...COMMON_HEADERS,
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
};

const AJAX_HEADERS = {
  ...COMMON_HEADERS,
  'accept': '*/*',
  'referer': 'https://mp3.big.az/',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'x-requested-with': 'XMLHttpRequest',
};

/**
 * Send a GA page_view for any user text.
 * @param {string} userText - What the user typed (e.g. "borcali havasi").
 */
async function sendAnalyticsForText(userText) {
  const params = { ...COMMON_QUERY };
  const title = `${userText} Mp3 Yukle Mp3 dinle`;
  params.dt = title;
  params.search_text = userText;

  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}?${qs}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: COMMON_HEADERS,
      body: null
    });
    return res.ok;
  } catch (err) {
    console.error('Error sending analytics:', err);
    return false;
  }
}

/**
 * Search for music on Big.az
 * @param {string} query - Search query
 * @returns {Promise<Object>} Search results with songs array
 */
async function searchMusic(query) {
  if (!query || !query.trim()) {
    return { songs: [], hasMore: false };
  }

  try {
    // Send analytics
    await sendAnalyticsForText(query);

    // Fetch search page (Big.az uses POST method for search)
    const searchUrl = SEARCH_BASE_URL;
    const formData = `query=${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        ...SEARCH_HEADERS,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const songs = [];
    
    // Parse search results from .playlis.playlis2 div
    $('.playlis.playlis2 p').each((index, element) => {
      const $el = $(element);
      
      // Extract download link and title
      const $link = $el.find('i.btndown a');
      const href = $link.attr('href');
      const title = $link.attr('title') || '';
      
      // Extract demo ID from btnplay
      const $playBtn = $el.find('i.btnplay');
      const mpdemo = $playBtn.attr('mpdemo');
      
      // Extract text content (song title)
      const textContent = $el.text().trim();
      
      if (href && textContent) {
        // Extract HTML filename from href (e.g., "/aref-kemal-lezginka-868412.html")
        const htmlFileName = href.startsWith('/') ? href.substring(1) : href;
        
        // Extract song ID from HTML filename (last number before .html)
        const songIdMatch = htmlFileName.match(/-(\d+)\.html$/);
        const songId = songIdMatch ? songIdMatch[1] : null;
        
        // Parse title and artist from text content
        // Format is usually "Artist - Title" or just "Title"
        const titleMatch = textContent.match(/^(.+?)\s*-\s*(.+)$/);
        let artist = '';
        let songTitle = textContent;
        
        if (titleMatch) {
          artist = titleMatch[1].trim();
          songTitle = titleMatch[2].trim();
        } else {
          // Try to extract from title attribute
          if (title.includes(' - ')) {
            const parts = title.split(' - ');
            artist = parts[0].trim();
            songTitle = parts[1] ? parts[1].replace(' mp3', '').trim() : textContent;
          }
        }
        
        if (songId) {
          songs.push({
            id: songId,
            title: songTitle,
            artist: artist || 'Unknown Artist',
            htmlFileName: htmlFileName,
            demoId: mpdemo || null,
            fullTitle: textContent,
          });
        }
      }
    });

    // Check for pagination
    const $pagination = $('.pagination a');
    const hasMore = $pagination.length > 0 && $pagination.text().includes('Növbəti');

    return {
      songs,
      hasMore,
      query,
    };
  } catch (err) {
    console.error('Error searching Big.az:', err);
    throw new Error(`Failed to search: ${err.message}`);
  }
}

/**
 * Fetch individual song page HTML
 * @param {string} htmlFileName - HTML filename (e.g., "aref-kemal-lezginka-868412.html")
 * @returns {Promise<Object>} Song page data
 */
async function fetchSongPage(htmlFileName) {
  if (!htmlFileName) {
    throw new Error('HTML filename is required');
  }

  try {
    const url = `${SONG_BASE_URL}${htmlFileName}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: SEARCH_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch song page: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract song ID from HTML filename
    const songIdMatch = htmlFileName.match(/-(\d+)\.html$/);
    const songId = songIdMatch ? songIdMatch[1] : null;

    if (!songId) {
      throw new Error('Could not extract song ID from filename');
    }

    // Try to find audio parameters from the page
    // These might be in JavaScript variables or data attributes
    let audioParams = {
      lk: null,
      mh: null,
      mr: null,
      hs: null,
    };

    // Look for JavaScript variables or data attributes
    const scriptContent = $('script').text();
    
    // Try to extract parameters from script tags or data attributes
    // This is a simplified approach - actual implementation may need adjustment
    const lkMatch = scriptContent.match(/lk['":\s]*=['"]?([^'"]+)['"]?/i);
    const mhMatch = scriptContent.match(/mh['":\s]*=['"]?([^'"]+)['"]?/i);
    const mrMatch = scriptContent.match(/mr['":\s]*=['"]?([^'"]+)['"]?/i);
    const hsMatch = scriptContent.match(/hs['":\s]*=['"]?([^'"]+)['"]?/i);

    if (lkMatch) audioParams.lk = lkMatch[1];
    if (mhMatch) audioParams.mh = mhMatch[1];
    if (mrMatch) audioParams.mr = mrMatch[1];
    if (hsMatch) audioParams.hs = hsMatch[1];

    // Extract title and artist from page
    const pageTitle = $('title').text().replace(' Mp3 Yukle Mp3 dinle', '').trim();
    const h1Title = $('.contentgray h1').text().trim();
    const title = h1Title || pageTitle;

    return {
      songId,
      title,
      htmlFileName,
      audioParams,
      html,
    };
  } catch (err) {
    console.error('Error fetching song page:', err);
    throw new Error(`Failed to fetch song page: ${err.message}`);
  }
}

/**
 * Get audio URL by sending AJAX request
 * @param {string} songId - Song ID
 * @param {Object} params - Audio parameters (lk, mh, mr, hs)
 * @returns {Promise<string>} Audio URL
 */
async function getAudioUrl(songId, params = {}) {
  if (!songId) {
    throw new Error('Song ID is required');
  }

  try {
    // Generate timestamp for cache busting
    const timestamp = Date.now();
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      id: songId,
      go: '7',
      _: timestamp.toString(),
    });

    // Add optional parameters if provided
    if (params.lk) queryParams.append('lk', params.lk);
    if (params.mh) queryParams.append('mh', params.mh);
    if (params.mr) queryParams.append('mr', params.mr);
    if (params.hs) queryParams.append('hs', params.hs);

    const url = `${AJAX_BASE_URL}?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: AJAX_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`AJAX request failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract audio URL from <source src="...">
    const audioUrl = $('audio source').attr('src');
    
    if (!audioUrl) {
      throw new Error('Audio URL not found in response');
    }

    return audioUrl;
  } catch (err) {
    console.error('Error getting audio URL:', err);
    throw new Error(`Failed to get audio URL: ${err.message}`);
  }
}

/**
 * Stream audio file for download
 * @param {string} audioUrl - Direct audio URL
 * @param {Object} res - Express response object
 * @param {string} filename - Filename for download
 */
async function streamAudio(audioUrl, res, filename) {
  try {
    const response = await fetch(audioUrl, {
      method: 'GET',
      headers: {
        'user-agent': COMMON_HEADERS['user-agent'],
        'referer': 'https://mp3.big.az/',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }

    // Set response headers
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Transfer-Encoding', 'chunked');

    // Stream the audio file
    response.body.pipe(res);
  } catch (err) {
    console.error('Error streaming audio:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed', message: err.message });
    }
  }
}

module.exports = {
  sendAnalyticsForText,
  searchMusic,
  fetchSongPage,
  getAudioUrl,
  streamAudio,
};
