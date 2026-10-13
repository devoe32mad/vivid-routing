(()=>{
 'use strict';
 const source=document.getElementById('responsibility-data');if(!source)return;
 const data=JSON.parse(source.textContent),items=new Map(data.entities.map(e=>[e.kind+':'+e.id,e]));
 const prefix=location.pathname.match(/^\/demo\/(?:ccps|rubber-world)/)?.[0]||'';
 const target=url=>url.startsWith('/demo/')?url:prefix+url;
 function badge(item){const box=document.createElement('div');box.className='resp-badge'+(item.assigned?'':' resp-unassigned');box.dataset.responsibilityRoot=item.root;box.append('Responsible party: ');const a=document.createElement('a');a.href=target(item.url);a.textContent=item.name;a.addEventListener('click',e=>e.stopPropagation());box.append(a);if(item.next||item.due){const small=document.createElement('small');small.style.display='block';small.textContent=[item.next,item.due?'Due '+item.due:''].filter(Boolean).join(' · ');box.append(small);}return box;}
 function put(container,item){if(!container||!item||[...container.querySelectorAll('[data-responsibility-root]')].some(n=>n.dataset.responsibilityRoot===item.root))return;container.append(badge(item));}
 document.querySelectorAll('[data-responsibility-kind][data-responsibility-id]').forEach(n=>{const item=items.get(n.dataset.responsibilityKind+':'+n.dataset.responsibilityId);if(item)n.replaceWith(badge(item));});
 document.querySelectorAll('a[href],form[action]').forEach(n=>{
  const href=(n.getAttribute('href')||n.getAttribute('action')||'').replace(/^\/demo\/(?:ccps|rubber-world)/,'');
  const match=href.match(/^\/org-(contract|advertising-request)\/(\d+)/)||href.match(/^\/org-(opportunity)\/(?:edit\/|duplicate\/)?(\d+)/);
  const qrId=Number(href.match(/[?&]qr_id=(\d+)/)?.[1]||href.match(/^\/admin\/view-qr\/(\d+)/)?.[1]);
  const campaignId=Number(href.match(/^\/org-campaign\/(\d+)/)?.[1]);
  const item=match?items.get((match[1]==='advertising-request'?'request':match[1])+':'+match[2]):data.entities.find(e=>qrId&&e.qr===qrId||campaignId&&e.campaign===campaignId);if(!item)return;
  const row=n.closest('tr');const card=row?row.querySelector('td'):n.closest('.marketplace-card,.card,article');put(card,item);
 });
 const path=location.pathname.replace(/^\/demo\/(?:ccps|rubber-world)/,'');
 const detail=path.match(/^\/org-(contract|advertising-request)\/(\d+)/)||path.match(/^\/org-(opportunity)\/edit\/(\d+)/);
 if(detail){const item=items.get((detail[1]==='advertising-request'?'request':detail[1])+':'+detail[2]);const main=document.querySelector('.wrap,.marketplace-wrap,main');if(main&&item)main.prepend(badge(item));}
 // Native enterprise pages without the shared navigation still expose the report.
 if(![...document.querySelectorAll('a')].some(a=>a.getAttribute('href')?.includes('/org-sales-reps'))){const link=document.createElement('a');link.href=target(data.report);link.textContent='Sales Rep Report →';link.className='resp-button';const box=document.createElement('div');box.style.cssText='max-width:1200px;margin:20px auto;padding:0 20px';box.append(link);const main=document.querySelector('main,.wrap,.marketplace-wrap');if(main)main.prepend(box);else document.body.prepend(box);}
})();
