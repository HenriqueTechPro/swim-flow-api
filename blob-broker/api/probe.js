// Single Vercel Node.js Function, intentionally DISABLED until separately
// approved staging Preview environment, dedicated nonce DB and HMAC are ready.
// This route NEVER returns Blob bytes or handles real athlete image paths.
import { createBrokerHandler } from '../lib/handler.mjs';

const handler = createBrokerHandler();

export default {
  fetch(request) {
    return handler.fetch(request);
  },
};
