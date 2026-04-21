import Fastify from 'fastify';
import cors from '@fastify/cors';
import { CORS_ORIGIN, PORT, tavilyEnabled } from './env.js';
import { configRoute } from './routes/config.js';
import { searchRoute } from './routes/search.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: CORS_ORIGIN,
  credentials: false,
});

await app.register(configRoute);
await app.register(searchRoute);

app.get('/health', async () => ({ ok: true, tavilyEnabled }));

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(
    `twinmind backend on :${PORT} — tavily ${tavilyEnabled ? 'enabled' : 'disabled'}`,
  );
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
