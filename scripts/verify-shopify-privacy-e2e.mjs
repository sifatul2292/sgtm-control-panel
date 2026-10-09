import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';

// Run after building the sibling Shopify app. All records and secrets are synthetic.
const panelRoot=fileURLToPath(new URL('../', import.meta.url));
const appRoot=resolve(process.argv[2] || join(panelRoot,'../tagioo-shopify-app'));
const panelNode=process.env.PANEL_NODE || process.execPath;
const temp=mkdtempSync(join(tmpdir(),'tagioo-privacy-e2e-'));
const panelUrl='http://127.0.0.1:17310', appUrl='http://127.0.0.1:17320';
const secret=randomBytes(32).toString('hex'), token=randomBytes(32).toString('hex');
const shop='privacy-fixture.myshopify.com', other='other-fixture.myshopify.com';
const { PrismaClient }=await import(pathToFileURL(join(appRoot,'node_modules/@prisma/client/default.js')));
const prisma=new PrismaClient({datasourceUrl:`file:${temp}/fixture.sqlite`});
const children=[]; let output='';
try {
  for(const dir of readdirSync(join(appRoot,'prisma/migrations')).sort()) {
    if(!dir.startsWith('20')) continue;
    for(const statement of readFileSync(join(appRoot,'prisma/migrations',dir,'migration.sql'),'utf8').split(';').filter(s=>s.trim())) await prisma.$executeRawUnsafe(statement);
  }
  for(const name of [shop,other]) await prisma.storeConnection.create({data:{shop:name,tenantId:name===shop?'fixture':'other',trackingDomain:panelUrl,measurementId:'G-TEST',integrationToken:token}});
  await prisma.session.create({data:{id:`offline_${shop}`,shop,state:'fixture',isOnline:false,accessToken:'synthetic-token',expires:new Date(0),refreshToken:'revoked-synthetic-refresh'}});
  writeFileSync(join(temp,'history.json'),JSON.stringify({tenants:[{id:'fixture',plan:'Free',tracking:{shopify:{shop,integrationToken:token}}},{id:'other',plan:'Free',tracking:{shopify:{shop:other,integrationToken:token}}}],orders:[{id:'101',tenantId:'fixture',source:'tagioo-shopify-app',raw:{shop_domain:shop,customer_id:'5'}},{id:'102',tenantId:'fixture',source:'tagioo-shopify-app',raw:{shop_domain:shop,customer_id:'6'}},{id:'201',tenantId:'other',source:'tagioo-shopify-app',raw:{shop_domain:other,customer_id:'5'}}]}));
  // Every app database call uses this disposable Prisma instance, including
  // Shopify's real session storage and the actual compiled route actions.
  writeFileSync(join(temp,'preload.mjs'),`import {PrismaClient} from ${JSON.stringify(pathToFileURL(join(appRoot,'node_modules/@prisma/client/default.js')).href)};global.prismaGlobal=new PrismaClient({datasourceUrl:${JSON.stringify(`file:${temp}/fixture.sqlite`)}});`);
  const clean={...process.env};
  for(const root of [panelRoot,appRoot]) {
    try { for(const line of readFileSync(join(root,'.env'),'utf8').split('\n')) {const match=line.match(/^([A-Z_][A-Z0-9_]*)=/);if(match)clean[match[1]]='';} }catch{}
  }
  const panel=spawn(panelNode,['server.js'],{cwd:panelRoot,env:{...clean,DATA_DIR:temp,HOST:'127.0.0.1',PORT:'17310',AUTO_LAUNCH_ENABLED:'false',TAGIOO_DATA_ENCRYPTION_KEY:'',SGTM_ACCESS_LOG:join(temp,'empty.log'),SGTM_ERROR_LOG:join(temp,'empty-error.log')}});
  const app=spawn(process.execPath,['--import',join(temp,'preload.mjs'),join(appRoot,'node_modules/@react-router/serve/bin.js'),'./build/server/index.js'],{cwd:appRoot,env:{...clean,NODE_ENV:'production',HOST:'127.0.0.1',PORT:'17320',SHOPIFY_API_KEY:'fixture-key',SHOPIFY_API_SECRET:secret,SHOPIFY_APP_URL:appUrl,SCOPES:'read_orders,read_pixels,write_pixels,read_customer_events',TAGIOO_API_URL:panelUrl,SHOPIFY_BILLING_ENABLED:'false',SHOPIFY_DATA_ENCRYPTION_KEY:randomBytes(32).toString('base64')}});
  children.push(panel,app);
  for(const child of children) {child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);}
  for(const url of [panelUrl,appUrl]) {
    let ready=false;
    for(let i=0;i<80;i++) {try {await fetch(url,{signal:AbortSignal.timeout(500)});ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}
    if(!ready) throw Error('Service did not start: '+output);
  }
  async function webhook(topic,path,payload,bad=false) {
    const body=JSON.stringify(payload);
    const response=await fetch(appUrl+path,{method:'POST',headers:{'content-type':'application/json','x-shopify-topic':topic,'x-shopify-shop-domain':shop,'x-shopify-api-version':'2026-07','x-shopify-webhook-id':randomBytes(16).toString('hex'),'x-shopify-hmac-sha256':createHmac('sha256',bad?'wrong':secret).update(body).digest('base64')},body});
    return response;
  }
  assert.equal((await webhook('customers/redact','/webhooks/customers/redact',{shop_domain:shop,customer:{id:5}},true)).status,401);
  assert.equal((await webhook('app/uninstalled','/webhooks/app/uninstalled',{shop_domain:shop})).status,200);
  assert.equal(await prisma.storeConnection.count({where:{shop}}),0);
  assert.equal(await prisma.session.count({where:{shop}}),0);
  assert.equal(await prisma.orderDelivery.count({where:{shop,topic:'PRIVACY_ROUTE'}}),1);
  console.log('PASS authenticated uninstall removed active connection/session and preserved encrypted privacy route');
  assert.equal((await webhook('customers/redact','/webhooks/customers/redact',{shop_domain:shop,customer:{id:5}})).status,200);
  let panelData=JSON.parse(readFileSync(join(temp,'history.json'),'utf8'));
  assert.deepEqual(panelData.orders.map(o=>o.id),['102','201']);
  console.log('PASS post-uninstall customer webhook crossed actual HTTP services and removed only matching customer');
  assert.equal((await webhook('shop/redact','/webhooks/shop/redact',{shop_domain:shop})).status,200);
  panelData=JSON.parse(readFileSync(join(temp,'history.json'),'utf8'));
  assert.deepEqual(panelData.orders.map(o=>o.id),['201']);
  assert.equal(await prisma.orderDelivery.count({where:{shop}}),0);
  assert.equal(await prisma.storeConnection.count({where:{shop:other}}),1);
  assert.equal((await webhook('shop/redact','/webhooks/shop/redact',{shop_domain:shop})).status,200);
  console.log('PASS delayed shop webhook erased isolated shop data, preserved other shop and accepted retry');
} finally {
  for(const child of children) child.kill('SIGTERM');
  await Promise.all(children.map(child=>new Promise(r=>child.exitCode!==null?r():child.once('exit',r))));
  await prisma.$disconnect(); rmSync(temp,{recursive:true,force:true});
}
