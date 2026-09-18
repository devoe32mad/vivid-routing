"use strict";
const fs=require('fs');
const path=require('path');
// Older reports label website/offer actions as offer_clicks. Include the modern
// destination event in that bucket so old and new reports count the same action.
function normalize(source){
  return source.replace(/WHERE (e\.)?type\s*=\s*'offer'/g,
    (_,prefix)=>`WHERE ${prefix||''}type IN ('offer','destination_click')`);
}
function install(){
  const file=path.join(__dirname,'server.js');
  const source=fs.readFileSync(file,'utf8');
  const changed=normalize(source);
  if(changed!==source)fs.writeFileSync(file,changed,'utf8');
}
module.exports={normalize,install};
