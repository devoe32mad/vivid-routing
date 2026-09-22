'use strict';
(() => {
  const field=document.getElementById('claim-code');
  const button=document.getElementById('copy-claim-code');
  const status=document.getElementById('copy-code-status');
  const form=document.getElementById('approve-checkout');
  const formatTime=value=>new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
  for(const element of document.querySelectorAll?.('time[datetime]')||[]){
    element.textContent=formatTime(element.dateTime)+' (device local time)';
  }
  async function copy(){
    try{
      await navigator.clipboard.writeText(field.value);
      status.textContent='Code copied.';
    }catch(error){
      field.focus();field.select();field.setSelectionRange(0,field.value.length);
      status.textContent='Code selected. Choose Copy from your device menu.';
    }
  }
  if(field && button && status){
    button.hidden=Boolean(form);
    button.addEventListener('click',copy);
  }
  const submit=document.getElementById('approve-button');
  const message=document.getElementById('approval-status');
  const steps=document.getElementById('checkout-steps');
  if(!form || !submit || !message || !steps || !field || !button || !status || typeof fetch!=='function' || typeof FormData!=='function')return;
  submit.textContent+=' & copy code';
  let busy=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy)return;
    busy=true;submit.disabled=true;message.textContent='Confirming offer…';
    try{
      const body=new URLSearchParams(new FormData(form));body.set('confirm','true');
      const response=await fetch(form.action,{method:'POST',credentials:'same-origin',headers:{Accept:'application/json'},body});
      if(!response.ok || response.redirected || !response.headers.get('content-type')?.includes('application/json'))throw Error('Approval unavailable');
      const result=await response.json();
      if(result.code!==field.value || !Number.isFinite(Date.parse(result.checkout_until)))throw Error('Invalid approval');
      document.getElementById('checkout-deadline').textContent=formatTime(result.checkout_until)+' (device local time)';
      form.hidden=true;steps.hidden=false;button.hidden=false;
      const title=document.querySelector?.('h1');if(title)title.textContent='Approved for this checkout';
      await copy();
    }catch(error){
      message.textContent='Could not confirm approval. Check your connection and Vivid sign-in, then retry or scan the offer again. Complete approval before taking payment.';
    }finally{
      busy=false;submit.disabled=false;
    }
  });
})();
