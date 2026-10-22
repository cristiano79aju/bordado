import assets from 'virtual:assets';
import {prepareFiles,seal,unseal,sha,unb64,isMatchingPayment} from './billing.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const enabled=env=>!!(env.CHECKOUT_SECRET&&env.ASAAS_API_KEY&&env.ASAAS_PIX_KEY&&env.PIX_LIVE_ENABLED==='true');
async function body(request){if(Number(request.headers.get('Content-Length'))>8000000)throw Error('Arquivo muito grande para o checkout.');const raw=await request.text();if(raw.length>8000000)throw Error('Arquivo muito grande para o checkout.');return JSON.parse(raw)}
async function asaas(env,path,options={}){if(!enabled(env))throw Error('Recebimentos Pix ainda não foram ativados pelo responsável pelo site.');const response=await fetch('https://api.asaas.com/v3'+path,{...options,headers:{'Content-Type':'application/json',access_token:env.ASAAS_API_KEY,'User-Agent':'BordAI-Atelier/1.0'},signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Não foi possível consultar o Pix. Tente novamente; nenhum arquivo foi liberado.');return response.json()}
async function paymentStatus(env,order){const response=await asaas(env,'/payments?limit=100&pixQrCodeId='+encodeURIComponent(order.qrId));return Array.isArray(response.data)&&response.data.some(p=>isMatchingPayment(p,order));}
export async function handle(request,env){const url=new URL(request.url),path=url.pathname;
 if(path==='/api/pix/config'&&request.method==='GET')return json({enabled:enabled(env),rateCents:100,perStitches:1000,rounding:'up',accountRequired:false});
 if(path.startsWith('/api/')){
  if(request.method!=='POST')return json({error:'Método não permitido.'},405);
  if(request.headers.get('Origin')!==url.origin)return json({error:'Origem não permitida.'},403);
  try{
   const input=await body(request);
   if(path==='/api/pix/quote'){
    if(!env.CHECKOUT_SECRET)return json({error:'Checkout em configuração. Nenhum pagamento está disponível.'},503);
    const data=prepareFiles(input),id=crypto.randomUUID(),hash=await sha(new TextEncoder().encode(JSON.stringify(data.identity)));delete data.identity;const quote={v:1,kind:'quote',id,hash,...data,exp:Date.now()+15*60000};
    return json({quoteToken:await seal(quote,env.CHECKOUT_SECRET),name:data.name,hash,stitches:data.stitches,amount:data.amount,enabled:enabled(env),expiresAt:quote.exp});
   }
   if(!enabled(env))return json({error:'Recebimentos Pix ainda não foram ativados pelo responsável pelo site.'},503);
   if(path==='/api/pix/create'){
    const quote=await unseal(input.quoteToken,env.CHECKOUT_SECRET);if(quote.kind!=='quote')throw Error('Cotação inválida.');
    const qr=await asaas(env,'/pix/qrCodes/static',{method:'POST',body:JSON.stringify({addressKey:env.ASAAS_PIX_KEY,value:quote.amount/100,description:'BordAI · '+quote.stitches+' pontos · '+quote.id.slice(0,8),format:'ALL',expirationSeconds:900,allowsMultiplePayments:false,externalReference:quote.id})});
    if(typeof qr.id!=='string'||typeof qr.payload!=='string'||!qr.payload.startsWith('000201')||typeof qr.encodedImage!=='string'||!/^iVBOR|^\/9j\//.test(qr.encodedImage))throw Error('O provedor não retornou um QR Code válido. Tente novamente.');
    const expiresAt=Date.now()+15*60000,order={...quote,kind:'order',qrId:qr.id,qrImage:qr.encodedImage,payload:qr.payload,qrExpiresAt:expiresAt,exp:Date.now()+30*86400000};
    return json({orderToken:await seal(order,env.CHECKOUT_SECRET),hash:quote.hash,stitches:quote.stitches,amount:quote.amount,name:quote.name,qrImage:qr.encodedImage,payload:qr.payload,expiresAt,accessExpiresAt:order.exp});
   }
   if(path==='/api/pix/status'||path==='/api/pix/download'){
    const order=await unseal(input.orderToken,env.CHECKOUT_SECRET);if(order.kind!=='order')throw Error('Pedido inválido.');const paid=await paymentStatus(env,order);
    if(path.endsWith('/status'))return json({paid,hash:order.hash,amount:order.amount,stitches:order.stitches,name:order.name,qrImage:order.qrImage,payload:order.payload,expiresAt:order.qrExpiresAt,accessExpiresAt:order.exp});
    if(!paid)return json({error:'Pagamento ainda não confirmado pelo Asaas.'},402);
    if(!['pes','dst'].includes(input.format))throw Error('Formato inválido.');
    return new Response(unb64(order.files[input.format]),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${order.name.replace(/[^A-Za-z0-9_-]/g,'_')}.${input.format}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
   }
   return json({error:'Operação não encontrada.'},404);
  }catch(e){return json({error:e.message==='Unexpected end of JSON input'?'Pedido inválido.':String(e.message||'Falha no checkout.')},400)}
 }
 const asset=assets[path==='/'?'/index.html':path];if(!asset)return new Response('Não encontrado',{status:404});return new Response(asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}
export default {fetch:handle};
