const CACHE='hfm-autopilot-v8';
const ASSETS=['./','./index.html','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(ASSETS);await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.pathname.includes('/functions/v1/')||url.pathname.includes('/rest/v1/')||url.origin!==self.location.origin)return;
 if(req.mode==='navigate'||url.pathname.endsWith('.html')||url.pathname==='/'){
  event.respondWith((async()=>{try{const fresh=await fetch(req,{cache:'no-store'});if(fresh.ok){const c=await caches.open(CACHE);c.put('./index.html',fresh.clone())}return fresh}catch(_){return (await caches.match('./index.html'))||Response.error()}})());
  return;
 }
 if(ASSETS.some(a=>new URL(a,self.location.href).pathname===url.pathname)){
  event.respondWith((async()=>{const cached=await caches.match(req);try{const fresh=await fetch(req);if(fresh.ok){const c=await caches.open(CACHE);c.put(req,fresh.clone())}return fresh}catch(_){return cached||Response.error()}})());
 }
});