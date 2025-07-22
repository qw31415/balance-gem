export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'GET') {
      return new Response('Miko is on duty! The balance-gem worker is running correctly.', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    const requestUrl = new URL(request.url);
    const clientKey = request.headers.get('x-api-key');

    let upstreamUrl;
    if (clientKey && clientKey === env.LOCAL_API_KEY && env.LOCAL_UPSTREAM_URL) {
      upstreamUrl = env.LOCAL_UPSTREAM_URL;
    } else {
      upstreamUrl = 'https://generativelanguage.googleapis.com';
    }

    const newRequestUrl = new URL(upstreamUrl + requestUrl.pathname + requestUrl.search);

    const newRequest = new Request(newRequestUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow',
    });

    // Remove Cloudflare-specific headers before sending to the upstream
    newRequest.headers.delete('cf-connecting-ip');
    newRequest.headers.delete('cf-worker');
    // ... and any other cf-* headers you want to remove

    try {
      const response = await fetch(newRequest);
      const newResponse = new Response(response.body, response);
      
      // Apply CORS headers to the final response
      Object.keys(corsHeaders).forEach(key => {
        newResponse.headers.set(key, corsHeaders[key]);
      });

      return newResponse;
    } catch (error) {
      const errorResponse = new Response(`Error fetching from upstream: ${error.message}`,
       { status: 502, headers: corsHeaders });
      return errorResponse;
    }
  },
};