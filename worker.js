export default {
  async fetch(request, env, ctx) {
    // 定义可复用的、更规范的CORS响应头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // 明确允许的方法
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key', // 明确允许客户端发送的请求头
      'Access-Control-Max-Age': '86400', // 允许客户端缓存预检请求结果一天，提高性能
    };

    // 优先处理预检请求 (OPTIONS)，这是解决405问题的关键
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204, // 使用 204 No Content，这是预检请求的标准响应
        headers: corsHeaders,
      });
    }

    // 处理浏览器直接访问或健康检查 (GET)
    if (request.method === 'GET') {
      return new Response('Miko is on duty! The balance-gem worker is running correctly. Ready for POST requests.', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    // 只处理核心的API调用 (POST)
    if (request.method === 'POST') {
      const requestUrl = new URL(request.url);
      const clientKey = request.headers.get('x-api-key');

      // 根据API密钥决定上游目标
      const upstreamUrl = (clientKey === env.LOCAL_API_KEY && env.LOCAL_UPSTREAM_URL)
        ? env.LOCAL_UPSTREAM_URL
        : 'https://generativelanguage.googleapis.com';

      const newRequestUrl = new URL(upstreamUrl + requestUrl.pathname + requestUrl.search);

      // 创建一个全新的请求对象，避免头部信息污染
      const newRequest = new Request(newRequestUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'follow',
      });

      // 清理Cloudflare特定的请求头
      newRequest.headers.delete('cf-connecting-ip');
      newRequest.headers.delete('cf-worker');

      try {
        const response = await fetch(newRequest);
        const newResponse = new Response(response.body, response);
        // 为最终响应应用CORS头
        Object.keys(corsHeaders).forEach(key => newResponse.headers.set(key, corsHeaders[key]));
        return newResponse;
      } catch (error) {
        // 如果上游（隧道）抓取失败，返回标准的502错误
        return new Response(`Error fetching from upstream: ${error.message}`,
         {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        });
      }
    }

    // 如果是其他任何方法 (PUT, DELETE等)，则明确返回405
    return new Response(`Method ${request.method} not allowed.`, {
      status: 405,
      headers: corsHeaders,
    });
  },
};