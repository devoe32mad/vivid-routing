'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ExcelJS=require('exceljs'),native=require('../ccps-native-experience');
test('native workbook keeps layout and paid results while masking Basic metrics',()=>{
 const book=new ExcelJS.Workbook(),state={rows:[{campaign_id:68,qr_id:97}]};
 const rows=[{campaignId:68,campaignName:'Basic',locationNames:'Barron',qrNames:'Gym'},{campaignId:69,campaignName:'Paid',locationNames:'Gulf',qrNames:'Outdoor'}];
 const sheet=book.addWorksheet('Campaign Summary');sheet.columns=[{key:'campaign'},{key:'scans'},{key:'conversions'},{key:'revenueGenerated'}];
 for(let i=0;i<4;i++)sheet.addRow(['Header']);sheet.addRow(['Basic',12,999,987654]);sheet.addRow(['Paid',240,8,400]);
 const details=book.addWorksheet('Basic details');details.__vividCampaignId=68;details.columns=[{key:'field'},{key:'value'}];
 for(let i=0;i<4;i++)details.addRow(['Header']);details.addRow(['Scans',12]);details.addRow(['Conversions',999]);details.addRow(['Revenue Generated',987654]);
 const summary=book.addWorksheet('Executive Summary');summary.columns=[{key:'metric'},{key:'value'}];for(let i=0;i<4;i++)summary.addRow(['Header']);summary.addRow(['Scans',252]);summary.addRow(['Conversions',1007]);
 native.maskWorkbook(book,state,rows);
 assert.equal(book.worksheets.length,3);assert.equal(sheet.getCell('B5').value,12);assert.equal(sheet.getCell('C5').value,'—');assert.equal(sheet.getCell('D5').value,'—');assert.equal(sheet.getCell('C6').value,8);assert.equal(sheet.getCell('D6').value,400);
 assert.equal(details.getCell('B5').value,12);assert.equal(details.getCell('B6').value,'—');assert.equal(summary.getCell('B5').value,252);assert.equal(summary.getCell('B6').value,'—');
});
