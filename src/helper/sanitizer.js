import DOMPurify from "dompurify";
import { logger } from "../core/logger";

/**
 * Strict DOMPurify configuration for sanitizing HTML
 */
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "code",
    "pre",
    "table",
    "tr",
    "td",
    "th",
    "tbody",
    "thead",
    "tfoot",
    "img",
  ],
  ALLOWED_ATTR: ["href", "title", "src", "alt", "width", "height"],
  KEEP_CONTENT: true,
  FORCE_BODY: false,
  RETURN_DOM: false,
};

/**
 * Sanitize HTML content using strict DOMPurify configuration
 * @param {string} html
 * @returns {string} Sanitized HTML
 */
export function sanitizeHtml(html) {
  try {
    return DOMPurify.sanitize(html, PURIFY_CONFIG);
  } catch (error) {
    logger.debug("HTML sanitization error", error);
    return "";
  }
}

/**
 * Safe URL protocols allowed in links
 */
const SAFE_PROTOCOLS = ["http", "https", "mailto"];

/**
 * Validate and sanitize URL
 * @param {string} url
 * @returns {string|null} Sanitized URL or null if invalid
 */
export function validateUrl(url) {
  if (!url || typeof url !== "string") {
    logger.debug("URL validation failed: not a string");
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    logger.debug("URL validation failed: empty string");
    return null;
  }

  // Relative URLs and anchors are safe
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return trimmed;
  }

  try {
    const urlObj = new URL(trimmed);
    const protocol = urlObj.protocol.replace(":", "");

    // Check if protocol is safe
    if (!SAFE_PROTOCOLS.includes(protocol)) {
      logger.debug("URL validation failed: unsafe protocol", protocol);
      return null;
    }

    return urlObj.toString();
  } catch (_error) {
    logger.debug("URL validation failed: malformed URL", trimmed);
    return null;
  }
}
