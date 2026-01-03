/**
 * Environment Configuration
 *
 * To switch environments:
 * - For local: cp .env.local .env
 * - For production: cp .env.production .env
 * - Then run: node scripts/build-config.js
 *
 * Or manually change API_BASE_URL below
 */

// Default to production (auto-generated from .env by build script)
export const API_BASE_URL = 'https://quirk-kvxe.onrender.com/api/v1';

// For local development, change to:
// export const API_BASE_URL = 'http://localhost:8000/api/v1';
