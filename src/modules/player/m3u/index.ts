/**
 * M3U Module - Complete M3U Pipeline
 * 
 * Exports all M3U-related functionality:
 * - Parser: Parse M3U content
 * - Validator: Validate playlists
 * - Sanitizer: Clean and normalize
 * - Loader: Fetch and process
 */

// Parser
export { 
  M3UParser, 
  m3uParser, 
  parseM3U,
  type M3UChannel,
  type M3UCategory,
  type M3UParseResult,
  type M3UParseOptions,
} from './M3UParser';

// Validator
export {
  M3UValidator,
  m3uValidator,
  validateM3U,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type ValidationStats,
  type StreamHealthResult,
} from './M3UValidator';

// Sanitizer
export {
  M3USanitizer,
  m3uSanitizer,
  sanitizeM3U,
  type SanitizeOptions,
  type SanitizeResult,
  type SanitizeAction,
} from './M3USanitizer';

// Loader
export {
  M3ULoader,
  m3uLoader,
  loadM3U,
  type LoadOptions,
  type LoadResult,
} from './M3ULoader';
