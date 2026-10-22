import {seal,unseal,unb64} from './billing.mjs';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const ready=env=>Boolean(env.PAYPAL_CLIENT_ID&&env.PAYPAL_CLIENT_SECRET&&env.CHECKOUT_SECRET&&env.PAYPAL_LIVE_ENABLED==='true'&&Number(env.PAYPAL_USD_CENTS_PER_1000)>0);
const host=env=>env.PAYPAL_MODE==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com';
async function api(env,path,method='GET',body,requestId){
 const authorization='Basic '+btoa(env.PAYPAL_CLIENT_ID+':'+env.PAYPAL_CLIENT_SECRET);
 const auth=await fetch(host(env)+'/v1/oauth2/token',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
 if(!auth.ok)throw Error('PayPal authentication failed.');
 const {access_token}=await auth.json();
 const res=await fetch(host(env)+path,{method,headers:{Authorization:'Bearer '+access_token,'Content-Type':'application/json',...(requestId?{'PayPal-Request-Id':requestId}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(!res.ok)throw Error('PayPal transaction unavailable.');
 return res.json();
}
function verified(order,reference,amount){
 const unit=order.purchase_units?.[0],capture=unit?.payments?.captures?.[0];
 return order.status==='COMPLETED'&&order.intent==='CAPTURE'&&order.purchase_units.length===1&&unit.reference_id===reference&&unit.payments.captures.length===1&&capture.status==='COMPLETED'&&capture.amount.currency_code==='USD'&&Math.round(Number(capture.amount.value)*100)===amount;
}
export async function paypal(path,input,env,origin){
 if(path==='/api/paypal/config')return reply({enabled:ready(env),sandbox:env.PAYPAL_MODE!=='live',rate:ready(env)?Number(env.PAYPAL_USD_CENTS_PER_1000):null});
 if(!ready(env))return reply({error:'PayPal is not configured.'},503);
 try{
 if(path==='/api/paypal/create'){
 const quote=await unseal(input.quoteToken,env.CHECKOUT_SECRET);
 if(quote.kind!=='quote')throw Error('Invalid quote.');
 const amount=Math.ceil(quote.stitches/1000)*Number(env.PAYPAL_USD_CENTS_PER_1000);
 if(!Number.isSafeInteger(amount)||amount<1)throw Error('Invalid USD amount.');
 const order=await api(env,'/v2/checkout/orders','POST',{intent:'CAPTURE',purchase_units:[{reference_id:quote.id,amount:{currency_code:'USD',value:(amount/100).toFixed(2)}}],application_context:{return_url:origin+'/',cancel_url:origin+'/',user_action:'PAY_NOW'}},'bordai-'+quote.id);
 const approval=order.links?.find(x=>x.rel==='approve')?.href;
 if(!approval||!/^https:\/\/www\.(sandbox\.)?paypal\.com\//.test(approval))throw Error('Missing PayPal approval.');
 const access={...quote,kind:'paypal-order',paypalId:order.id,usdAmount:amount,exp:Date.now()+30*86400000};
 return reply({accessToken:await seal(access,env.CHECKOUT_SECRET),approvalUrl:approval,amount});
 }
 if(path==='/api/paypal/confirm'||path==='/api/paypal/download'){
 const access=await unseal(input.accessToken,env.CHECKOUT_SECRET);
 if(access.kind!=='paypal-order'||! /^[A-Z0-9]+$/.test(access.paypalId))throw Error('Invalid order.');
 let order=await api(env,'/v2/checkout/orders/'+access.paypalId);
 if(path.endsWith('/confirm')&&order.status==='APPROVED')order=await api(env,'/v2/checkout/orders/'+access.paypalId+'/capture','POST',{},'bordai-capture-'+access.id);
 const paid=verified(order,access.id,access.usdAmount);
 if(path.endsWith('/confirm'))return reply({paid,hash:access.hash});
 if(!paid)return reply({error:'Payment not confirmed.'},402);
 if(!['pes','dst'].includes(input.format))return reply({error:'Invalid format.'},400);
 return new Response(unb64(access.files[input.format]),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="BordAI.'+input.format+'"','Cache-Control':'no-store'}});
 }
 return reply({error:'Not found.'},404);
 }catch(e){return reply({error:e.message||'PayPal failed.'},400)}
}
