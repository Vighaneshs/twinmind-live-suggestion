import type { FastifyInstance } from 'fastify';
import { tavilyEnabled } from '../env.js';
import { searchMany } from '../tavily.js';

type Body = { queries?: unknown };

export async function searchRoute(app: FastifyInstance) {
  app.post('/api/search', async (req, reply) => {
    if (!tavilyEnabled) {
      return { results: [], disabled: true };
    }
    const body = (req.body ?? {}) as Body;
    const queries = Array.isArray(body.queries)
      ? body.queries
          .map((q) => String(q).trim())
          .filter((q) => q.length > 0)
          .slice(0, 2)
      : [];
    if (!queries.length) return { results: [] };
    try {
      const results = await searchMany(queries);
      return { results };
    } catch (err) {
      req.log.warn({ err }, 'tavily search failed');
      reply.code(502);
      return { results: [], error: 'upstream_failed' };
    }
  });
}
