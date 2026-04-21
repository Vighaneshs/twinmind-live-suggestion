import type { FastifyInstance } from 'fastify';
import { tavilyEnabled } from '../env.js';

export async function configRoute(app: FastifyInstance) {
  app.get('/api/config', async () => ({ tavilyEnabled }));
}
