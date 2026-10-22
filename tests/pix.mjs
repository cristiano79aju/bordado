import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {priceFor,prepareFiles,isMatchingPayment,seal,unseal} from '../worker/billing.mjs';
import {handle} from '../dist/server/index.js';
for(const [n,cents]of [[1,100],[999,100],[1000,100],[1001,200],[23063,2400]])assert.equal(priceFor(n),cents);
for(const n of [0,-1,NaN,1.5])assert.throws(()=>priceFor(n));
const input={name:'Teste Pix',commands:[[0,0,1],...Array.from({length:1001},(_,i)=>[(i%100)*.1,Math.floor(i/100)*.1,0]),[0,0,2],[10,10,1]],colors:['#aabbcc'],amount:1,stitches:1};
const files=prepareFiles(input);assert.equal(files.stitches,1001);assert.equal(files.amount,200);assert.throws(()=>prepareFiles({...input,colors:['#ffffff','#000000']}));assert.throws(()=>prepareFiles({...input,commands:[[NaN,0,0]]}));
const secret=randomBytes(32).toString('base64'),token=await seal({v:1,kind:'quote',amount:200,stitches:1001,exp:Date.now()+10000},secret);assert.equal((await unseal(token,secret)).amount,200);await assert.rejects(()=>unseal(token.slice(0,10)+'x'+token.slice(11),secret));await assert.rejects(()=>unseal(token,randomBytes(32).toString('base64')));
const env={CHECKOUT_SECRET:secret,ASAAS_API_KEY:'isolated-test-only',ASAAS_PIX_KEY:'isolated-test-only',PIX_LIVE_ENABLED:'true'};let received=false;const nativeFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{assert(String(url).startsWith('https://api.asaas.com/v3/'));if(String(url).endsWith('/pix/qrCodes/static')){const body=JSON.parse(options.body);assert.equal(body.value,2);assert.equal(body.allowsMultiplePayments,false);assert.equal(body.expirationSeconds,900);return Response.json({id:'qr-isolated-test',payload:'000201TEST_ONLY',encodedImage:'iVBORTEST_ONLY'})}return Response.json({data:[{pixQrCodeId:'qr-isolated-test',billingType:'PIX',status:received?'RECEIVED':'PENDING',value:2}]})};
const post=(path,body,origin='https://site.test')=>handle(new Request('https://site.test/api/pix/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}),env);
try{
 assert.equal((await post('quote',input,'https://attacker.test')).status,403);
 const quote=await (await post('quote',input)).json();assert.equal(quote.amount,200);assert.equal(quote.stitches,1001);assert(quote.enabled);assert(!quote.files);const renamed=await (await post('quote',{...input,name:'Outro nome'})).json();assert.equal(renamed.hash,quote.hash);
 const order=await (await post('create',{quoteToken:quote.quoteToken})).json();assert(order.orderToken);assert(!order.files);
 assert.equal((await post('download',{orderToken:order.orderToken,format:'pes',paid:true})).status,402);
 assert.equal((await (await post('status',{orderToken:order.orderToken})).json()).paid,false);
 received=true;assert.equal((await (await post('status',{orderToken:order.orderToken})).json()).paid,true);
 for(const format of ['pes','dst']){const download=await post('download',{orderToken:order.orderToken,format});assert.equal(download.status,200);const bytes=new Uint8Array(await download.arrayBuffer());assert(bytes.length>500);assert.equal(download.headers.get('Cache-Control'),'no-store')}
 assert.equal((await post('download',{orderToken:order.orderToken,format:'emb'})).status,400);
 const orderData=await unseal(order.orderToken,secret);const payment={pixQrCodeId:orderData.qrId,billingType:'PIX',status:'RECEIVED',value:2};assert(isMatchingPayment(payment,orderData));for(const change of [{pixQrCodeId:'other'},{value:1},{billingType:'CREDIT_CARD'},{status:'REFUNDED'},{refundedValue:1},{deleted:true}])assert(!isMatchingPayment({...payment,...change},orderData));
 const disabled=await handle(new Request('https://site.test/api/pix/create',{method:'POST',headers:{Origin:'https://site.test'},body:JSON.stringify({quoteToken:quote.quoteToken})}),{CHECKOUT_SECRET:secret});assert.equal(disabled.status,503);
 assert.equal((await handle(new Request('https://site.test/formats.mjs'),env)).status,404);
 const app=await (await handle(new Request('https://site.test/app.mjs'),env)).text();assert(!app.includes('writePES')&&!app.includes('writeDST'));console.log('PIX: price boundaries, server recount, token tampering, pending/paid exports, QR/amount/refund validation, origin protection and disabled live billing passed. No real payments made.');
}finally{globalThis.fetch=nativeFetch}
