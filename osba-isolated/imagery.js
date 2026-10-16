import {readFileSync} from 'node:fs';
// Official OSBA imagery, stored inside this isolated demo only.
export const imagery={
 'conference-hero.webp':{label:'OSBA 2026 Capital Conference artwork',source:'https://conferencecontent.ohioschoolboards.org/sites/default/files/2026-06/LandingPage_Hero.webp'},
 'student-fair.jpg':{label:'OSBA Student Achievement Fair — representative conference photo',source:'https://www.ohioschoolboards.org/sites/default/files/2026-08/SAF-54938512378_b63f310aed_c.jpg'},
 'board-meeting.jpg':{label:'OSBA board collaboration illustration — representative imagery',source:'https://www.ohioschoolboards.org/sites/default/files/2021-05/21CallNom_0.jpg'},
 'communications.jpg':{label:'OSBA communications workshop artwork — representative imagery',source:'https://www.ohioschoolboards.org/sites/default/files/2024-10/2024_FallCommWorkshop_WebBanner.jpg'}
};
for(const [file,asset] of Object.entries(imagery)){asset.file=file;asset.bytes=readFileSync(new URL('./assets/'+file,import.meta.url));asset.mime=file.endsWith('.webp')?'image/webp':'image/jpeg';}
export function opportunityImage(o){return imagery[o.program_id===3?([26,33,34,37].includes(o.id)?'student-fair.jpg':'conference-hero.webp'):o.program_id===4?'board-meeting.jpg':o.program_id===2?'communications.jpg':'board-meeting.jpg'];}
export function programImage(id){return imagery[id===3?'conference-hero.webp':id===2?'communications.jpg':'board-meeting.jpg'];}
