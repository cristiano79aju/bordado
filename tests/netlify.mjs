import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import pix,{config} from '../build/functions/pix.mjs';
assert.equal(config.path,'/api/pix/*');
const files=await fs.readdir('build/client');
assert(files.includes('index.html') && files.includes('read-formats.mjs'));
assert(!files.includes('formats.mjs') && !files.includes('server') && !files.includes('.env'));
const original=Object.fromEntries(['CHECKOUT_SECRET','ASAAS_API_KEY','ASAAS_PIX_KEY','PIX_LIVE_ENABLED'].map(k=>[k,process.env[k]]));
try {
  process.env.CHECKOUT_SECRET=randomBytes(32).toString('base64');
  process.env.PIX_LIVE_ENABLED='false';
  const get=await pix(new Request('https://atelier.example/api/pix/config'));
  assert.equal(get.status,200);assert.equal((await get.json()).enabled,false);
  const payload={name:'Netlify',commands:[[0,0,1],[1,1,0],[2,1,0]],colors:['#123456']};
  const request=(body,origin='https://atelier.example')=>new Request('https://atelier.example/api/pix/quote',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)});
  const quote=await pix(request(payload));assert.equal(quote.status,200);
  const data=await quote.json();assert.equal(data.amount,100);assert.equal(data.stitches,2);assert(data.quoteToken);
  assert.equal((await pix(request(payload,'https://other.example'))).status,403);
  assert.equal((await pix(new Request('https://atelier.example/formats.mjs'))).status,404);
  assert.equal((await pix(new Request('https://atelier.example/api/pix/download',{method:'POST',headers:{Origin:'https://atelier.example'},body:JSON.stringify({paid:true})}))).status,503);
  console.log('Netlify adapter: routing, runtime secrets, quote, origin checks, disabled payment and public asset isolation passed.');
} finally {
  for(const [key,value]of Object.entries(original)) if(value===undefined)delete process.env[key];else process.env[key]=value;
}
