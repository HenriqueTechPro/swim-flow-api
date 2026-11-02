// HMAC-authenticated PRIVATE media transport for the NestJS server only.
import { createMediaHandler } from '../lib/media-handler.mjs';
const handler = createMediaHandler();
export default { fetch(request) { return handler.fetch(request); } };
