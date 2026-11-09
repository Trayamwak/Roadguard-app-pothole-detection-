import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
    body: JSON.stringify({
      status: 'ok',
      platform: 'netlify-functions',
      gemini: process.env.GEMINI_API_KEY ? 'configured' : 'fallback_mode',
      model: 'gemini-3.8-flash',
      timestamp: new Date().toISOString(),
    }),
  };
};
