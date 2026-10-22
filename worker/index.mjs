import assets from 'virtual:assets';
import {prepareFiles,seal,unseal,sha,unb64,isMatchingPayment} from './billing.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const adminCookie='bordai_admin';
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function passwordMatches(password,stored){if(typeof password!=='string'||password.length<8||password.length>256||!stored)return false;const parts=stored.split(':');if(parts.length!==2||!/^[a-f0-9]{32}$/.test(parts[0])||!/^[a-f0-9]{64}$/.test(parts[1]))return false;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(parts[0].match(/../g),v=>parseInt(v,16)),iterations:210000,hash:'SHA-256'},key,256);const actual=new Uint8Array(bits),expected=Uint8Array.from(parts[1].match(/../g),v=>parseInt(v,16));let diff=0;for(let i=0;i<32;i++)diff|=actual[i]^expected[i];return diff===0;}
async function isAdmin(request,env){if(!env.ADMIN_PASSWORD_HASH||!env.CHECKOUT_SECRET)return false;const value=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(adminCookie+'='))?.slice(adminCookie.length+1);if(!value)return false;try{const session=await unseal(value,env.CHECKOUT_SECRET);return session.kind==='admin'&&session.exp>Date.now()}catch{return false}}
const adminSessionHeaders=token=>({'Set-Cookie':adminCookie+'='+token+'; HttpOnly; Secure; SameSite=Strict; Path=/api/pix; Max-Age=28800','Cache-Control':'no-store'});
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
   if(path==='/api/pix/admin/login'){
    if(!env.ADMIN_PASSWORD_HASH||!env.CHECKOUT_SECRET)return json({error:'Acesso administrativo ainda não configurado.'},503);
    if(input.email!=='cristiano.se.adm@gmail.com'||!await passwordMatches(input.password,env.ADMIN_PASSWORD_HASH))return json({error:'Senha incorreta.'},401);
    const token=await seal({kind:'admin',exp:Date.now()+8*3600000},env.CHECKOUT_SECRET);
    return new Response(JSON.stringify({authenticated:true}),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...adminSessionHeaders(token)}});
   }
   if(path==='/api/pix/admin/status')return json({authenticated:await isAdmin(request,env)});
   if(path==='/api/pix/admin/logout')return new Response(JSON.stringify({authenticated:false}),{headers:{'Content-Type':'application/json','Set-Cookie':adminCookie+'=; HttpOnly; Secure; SameSite=Strict; Path=/api/pix; Max-Age=0','Cache-Control':'no-store'}});
   if(path==='/api/pix/admin/download'){
    if(!await isAdmin(request,env))return json({error:'Acesso administrativo não autorizado.'},401);
    const quote=await unseal(input.quoteToken,env.CHECKOUT_SECRET);if(quote.kind!=='quote')throw Error('Cotação inválida.');
    if(!['pes','dst'].includes(input.format))throw Error('Formato inválido.');
    return new Response(unb64(quote.files[input.format]),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${quote.name.replace(/[^A-Za-z0-9_-]/g,'_')}.${input.format}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
   }
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
