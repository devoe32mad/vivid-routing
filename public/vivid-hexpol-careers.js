/* ADP integration helper. ADP must call VividHexpolCareers.openJob(reqId) from its job-selection handler. */
(function () {
  'use strict';
  if (location.hostname !== 'myjobs.adp.com' || !location.pathname.startsWith('/hexpolexternalcareersite/')) return;
  var base='https://vivid-routing-production.up.railway.app';
  var key='vivid-hexpol-88-click';
  var uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var id=new URL(location.href).searchParams.get('vivid_click_id');
  var saved=null;
  try {
    if(id && uuid.test(id)) sessionStorage.setItem(key,JSON.stringify({id:id,at:Date.now()}));
    saved=JSON.parse(sessionStorage.getItem(key)||'null');
  } catch(e) {}
  if(!id || !uuid.test(id)) id=saved && Date.now()-saved.at<86400000 && uuid.test(saved.id)?saved.id:null;
  var mapping={"5001231752606": "26-1039", "26-1039": "26-1039", "5001231751506": "26-1038", "26-1038": "26-1038", "5001231392406": "26-1036", "26-1036": "26-1036", "5001231311706": "26-1034", "26-1034": "26-1034", "5001230712506": "26-1033", "26-1033": "26-1033", "5001230712206": "26-1032", "26-1032": "26-1032", "5001230000506": "26-1031", "26-1031": "26-1031", "5001229996806": "26-1030", "26-1030": "26-1030", "5001229993906": "26-1029", "26-1029": "26-1029", "5001229927606": "26-1028", "26-1028": "26-1028", "5001229840006": "26-1017", "26-1017": "26-1017", "5001229841806": "26-1018", "26-1018": "26-1018", "5001229914106": "26-1027", "26-1027": "26-1027", "5001229908106": "26-1024", "26-1024": "26-1024", "5001229888306": "26-1023", "26-1023": "26-1023", "5001229886806": "26-1022", "26-1022": "26-1022", "5001229884906": "26-1021", "26-1021": "26-1021", "5001229881806": "26-1020", "26-1020": "26-1020", "5001229808606": "26-1016", "26-1016": "26-1016", "5001229803906": "26-1014", "26-1014": "26-1014", "5001229807006": "26-1015", "26-1015": "26-1015", "5001229798806": "26-1012", "26-1012": "26-1012", "5001229749806": "26-1011", "26-1011": "26-1011", "5001224610906": "26-1009", "26-1009": "26-1009", "5001224155006": "26-1006", "26-1006": "26-1006", "5001224153706": "26-1005", "26-1005": "26-1005", "5001224608606": "26-1008", "26-1008": "26-1008"};
  window.VividHexpolCareers={
    trackingUrl:function(reqId){
      var requisition=mapping[String(reqId)];
      if(!requisition || !id) return null;
      return base+'/hexpol-careers/job/'+requisition+'?vivid_click_id='+encodeURIComponent(id);
    },
    openJob:function(reqId){
      var url=this.trackingUrl(reqId);
      if(!url) return false;
      location.assign(url);return true;
    }
  };
})();
