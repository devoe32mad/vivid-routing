import fs from 'node:fs';
const {handle}=await import('./pac-world.js');const origin='http://localhost';
const entry=await handle(new Request(origin+'/pac-world-review/'+process.env.PAC_DEMO_TOKEN+'/enterprise'));const cookie=entry.headers.get('set-cookie').split(';')[0];
const queue=['/org-organization/pac-world-demo','/advertise/pac-world-demo','/my-setup','/reports','/org-contracts','/org-advertisers','/org-performance','/org-revenue-pipeline','/org-advertising-requests','/org-renewals'].map(p=>({p:'/demo/pac-world'+p,d:0}));const seen=new Set();let fails=[];
while(queue.length&&seen.size<180){const {p,d}=queue.shift();if(seen.has(p)||/delete|disable|enable|archive|deactivate/.test(p))continue;seen.add(p);const r=await handle(new Request(origin+p,{headers:{cookie}}));const text=await r.text();if(r.status>=400)fails.push([p,r.status,text.slice(0,100)]);if(d<2&&r.headers.get('content-type')?.includes('text/html'))for(const m of text.matchAll(/href="([^"#]+)"/g)){const h=m[1].replaceAll('&amp;','&');if(h.startsWith('/demo/pac-world/'))queue.push({p:h,d:d+1});}}
console.log(JSON.stringify({checked:seen.size,fails},null,2));process.exit(fails.length?1:0);
