// Runtime values only: never inline credentials into the browser build.
import {handle} from '../dist/server/index.js';
export default async function pix(request) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/api/pix/')) return new Response('Não encontrado', {status:404});
  return handle(request, {
    CHECKOUT_SECRET:process.env.CHECKOUT_SECRET,
    ASAAS_API_KEY:process.env.ASAAS_API_KEY,
    ASAAS_PIX_KEY:process.env.ASAAS_PIX_KEY,
    PIX_LIVE_ENABLED:process.env.PIX_LIVE_ENABLED,
    ADMIN_PASSWORD_HASH:process.env.ADMIN_PASSWORD_HASH
  });
}
export const config = {path:'/api/pix/*'};
