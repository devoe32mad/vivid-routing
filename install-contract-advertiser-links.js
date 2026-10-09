"use strict";
const MARKER='// CONTRACT_ADVERTISER_LINKS_V1';
function install(source){
 if(source.includes(MARKER))return source;
 const start=source.indexOf('app.get("/org-contracts",');
 const detail=source.indexOf('  "/org-contract/:contractId",',start);
 const end=source.indexOf('\napp.',detail);
 if(start<0||detail<0||end<0)throw Error('Contract routes missing');
 let part=source.slice(start,end);
 // Use the contract's advertiser, including manually seeded demonstration sponsors.
 let joins=0;
 part=part.replace(/LEFT JOIN organization_advertising_requests ar\s+ON ar.id = c.advertising_request_id\s+AND ar.organization_id = c.organization_id/g,()=>{joins++;return `LEFT JOIN advertisers contract_advertiser
            ON contract_advertiser.id = c.advertiser_id
           AND contract_advertiser.organization_id = c.organization_id
          LEFT JOIN LATERAL (
            SELECT request.* FROM organization_advertising_requests request
            WHERE request.organization_id=c.organization_id
              AND (request.id=c.advertising_request_id OR request.created_contract_id=c.id)
            ORDER BY (request.id=c.advertising_request_id) DESC NULLS LAST, request.id DESC
            LIMIT 1
          ) ar ON true`;});
 if(joins!==2)throw Error('Expected two contract advertiser joins');
 part=part.replace(/COALESCE\(\s+ar.business_name,\s+u.name,/g,'COALESCE(\n              NULLIF(contract_advertiser.name, \'\'),\n              ar.business_name,\n              u.name,');
 const condition='contract.advertising_request_id\n                      ? `';
 if(!part.includes(condition))throw Error('Contract action anchor missing');
 part=part.replace(condition,'contract.id\n                      ? `');
 // Apply the same organization/location permissions as the contract list.
 const anchor='      const contractResult = await q(';
 if(part.split(anchor).length!==2)throw Error('Contract detail query anchor missing');
 part=part.replace(anchor,`      const contractScope = await getOrganizationScope(req, organizationId);
      if (contractScope.organizationId !== organizationId) return res.status(403).send("Access denied");
`+anchor);
 const guard='const renewedToResult = await q(';
 part=part.replace(guard,`if (!contractScope.allowedLocationIds.includes(Number(contract.location_id))) {
  return res.status(403).send("Access denied");
}
`+guard);
 return source.slice(0,start)+part+source.slice(end)+'\n'+MARKER+'\n';
}
module.exports={install};
