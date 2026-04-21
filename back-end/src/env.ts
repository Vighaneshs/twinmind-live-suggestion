export const TAVILY_API_KEY = process.env.TAVILY_API_KEY?.trim() ?? '';
export const PORT = Number(process.env.PORT ?? 8080);
export const CORS_ORIGIN =
  process.env.CORS_ORIGIN?.trim() || 'http://localhost:5173';
export const tavilyEnabled = TAVILY_API_KEY.length > 0;
