/**
 * Utility helper functions
 */

/**
 * Sanitize filename for safe download
 * Removes/replaces characters that are invalid in filenames
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
const sanitizeFilename = (filename) => {
  if (!filename) return 'download';
  
  return filename
    // Remove/replace invalid characters for filesystem
    .replace(/[<>:"/\\|?*]/g, '')
    // Remove non-ASCII characters (required for HTTP headers)
    .replace(/[^\x20-\x7E]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Remove leading/trailing spaces
    .trim()
    // Limit length (keep some room for extension)
    .substring(0, 200)
    // Default if empty after sanitization
    || 'download';
};

/**
 * Format duration from seconds to readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g., "3:45" or "1:02:30")
 */
const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Extract video ID from various YouTube URL formats
 * @param {string} url - YouTube URL or video ID
 * @returns {string|null} Video ID or null if not found
 */
const extractVideoId = (url) => {
  if (!url) return null;
  
  // Already a video ID (11 characters)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }
  
  // Try to extract from URL
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
};

/**
 * Create a safe Content-Disposition header value
 * Uses ASCII-only filename for maximum compatibility
 * @param {string} filename - The filename (should be pre-sanitized)
 * @returns {string} Safe Content-Disposition header value
 */
const getContentDisposition = (filename) => {
  // Ensure filename is ASCII-safe
  const safeFilename = sanitizeFilename(filename);
  // Use simple format without quotes to avoid header parsing issues
  return `attachment; filename=${safeFilename.replace(/\s/g, '_')}`;
};

module.exports = {
  sanitizeFilename,
  formatDuration,
  extractVideoId,
  getContentDisposition,
};
