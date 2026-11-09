/** Register idempotently when enabled; remove only Sara-owned workers/caches when disabled. */
export function pwaRegistrationScript(enabled:boolean):string {
  return `(function(){
    if(!('serviceWorker' in navigator))return;
    var enabled=${enabled?'true':'false'};
    if(enabled){
      var start=function(){navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(function(){});};
      if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
      return;
    }
    navigator.serviceWorker.getRegistrations().then(function(registrations){
      return Promise.all(registrations.filter(function(reg){
        return [reg.active,reg.waiting,reg.installing].some(function(worker){
          if(!worker)return false;try{var url=new URL(worker.scriptURL);return url.origin===location.origin&&url.pathname==='/sw.js';}catch(_){return false;}
        });
      }).map(function(reg){return reg.unregister();}));
    }).then(function(){
      if(!window.caches)return;return caches.keys().then(function(keys){return Promise.all(keys.filter(function(key){
        return /^(app-cache-v[0-9]+|api-cache-v[0-9]+|sara-static-v[0-9]+|sara-public-v[0-9]+)$/.test(key);
      }).map(function(key){return caches.delete(key);}));});
    }).catch(function(){});
  })();`
}
