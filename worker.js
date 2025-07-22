export default {
  async fetch(request, env) {
    // 1. 定义CORS响应头，确保跨域请求顺畅
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key', // 保留 x-api-key 以便未来可能的扩展
    };

    // 2. 优先处理预检请求 (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 3. 处理浏览器直接访问 (GET)，返回一个清晰的状态页面
    if (request.method === 'GET') {
      return new Response('Miko is on duty! The All-in-One Gemini Balance Worker is running perfectly.', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders },
      });
    }

    // 4. --- 核心逻辑：处理API转发 (POST) ---
    if (request.method === 'POST') {
      // 从环境变量中读取您所有的 Gemini API 密钥
      const apiKeys = (env.GEMINI_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);

      if (apiKeys.length === 0) {
        return new Response('GEMINI_API_KEYS environment variable is not set or empty.', {
          status: 500,
          headers: corsHeaders,
        });
      }

      // 核心中的核心：随机选择一个密钥进行负载均衡，这是最健壮的方式
      const selectedApiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

      // 目标API的URL
      const googleApiUrl = 'https://generativelanguage.googleapis.com';
      const requestUrl = new URL(request.url);
      const targetUrl = new URL(googleApiUrl + requestUrl.pathname + requestUrl.search);

      // 创建一个新的请求，并将选中的密钥加入查询参数
      targetUrl.searchParams.set('key', selectedApiKey);

      // 复制原始请求的 body 和 method
      const newRequest = new Request(targetUrl, {
        method: request.method,
        headers: { 'Content-Type': 'application/json' }, // Google API 需要这个头
        body: request.body,
        redirect: 'follow',
      });

      // 发起请求并流式返回响应
      const response = await fetch(newRequest);
      const newResponse = new Response(response.body, response);

      // 为最终响应加上CORS头
      Object.keys(corsHeaders).forEach(key => newResponse.headers.set(key, corsHeaders[key]));

      return newResponse;
    }

    // 5. 拒绝所有其他方法
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  },
};