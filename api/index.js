import worker from '../dist/server/index.js';

export default async function handler(req, res) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const url = new URL(req.url || '/', proto + '://' + host);
    const method = req.method || 'GET';
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    let body;
    if (method !== 'GET' && method !== 'HEAD') {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8000000) {
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({error: 'Arquivo muito grande para o checkout.'}));
          return;
        }
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }
    const request = new Request(url, {method, headers, ...(body ? {body} : {})});
    const response = await worker.fetch(request, process.env);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('BordAI API error', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({error: 'Falha interna do servidor.'}));
  }
}
