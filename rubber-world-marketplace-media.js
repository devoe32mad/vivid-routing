'use strict';
const base='https://rubberworld.com/wp-content/uploads/';
const logo=base+'2026/10/RWAnnvLogo_138wht.png';
const cover=base+'elementor/thumbs/RW-September26-1-rtjlezxjtnh6l745z0imgcd93p98w3cxbnxyrkyc9s.png';
const blue=base+'2022/01/BB23cover.png',red=base+'2021/02/RBcover-2.png';
function media(o){
 const channel=o.channel||'',title=o.title||'',edition=o.edition||'';
 if(/Blue Book|Red Book/.test(channel))return {src:/Red Book/.test(edition)?red:blue,alt:/Red Book/.test(edition)?'Rubber Red Book cover':'Rubber World Blue Book cover',caption:'Example cover from Rubber World’s website',kind:'cover'};
 if(/Print|Digital/.test(channel))return {src:cover,alt:'Rubber World September 2026 cover',caption:'Publication example · September 2026 cover',kind:'cover'};
 if(/Website/.test(channel)){
  if(/Right Column/.test(title))return {src:base+'2021/04/RH-RW-Advert-9April21.jpg',alt:'Existing right-column advertisement on Rubber World',caption:'Existing website ad example · Your creative replaces this artwork',kind:'ad'};
  if(/Section Row/.test(title))return {src:base+'2026/08/0000145783-Univar-CASE-NA-Rubber-World-Web-Banner-Ad-728x90-Sept-Final-x2-e1787841757309.jpg',alt:'Existing horizontal website banner on Rubber World',caption:'Existing website ad example · Your creative replaces this artwork',kind:'banner'};
  return {src:base+'2021/03/struktol_360x90.png',alt:'Existing page-sponsor banner on Rubber World',caption:'Existing website ad example · Your creative replaces this artwork',kind:'banner'};
 }
 if(/Global Polymer/.test(channel))return {src:base+'2026/09/GPS_300x250.jpg',alt:'Global Polymer Summit artwork from Rubber World',caption:'Event artwork from Rubber World’s website · Historical 2026 example',kind:'ad'};
 return {src:logo,alt:'Rubber World',caption:'Rubber World masthead · '+channel,kind:'brand'};
}
function content(o){
 const c=o.channel,t=o.title;
 if(/Website/.test(c))return {summary:'Put your company in front of readers browsing Rubber World’s industry news and technical coverage.',spec:/360/.test(t)?'360 × 90 px':/728/.test(t)?'728 × 90 px':/300/.test(t)?'300 × 250 px':'Format confirmed with publisher',includes:['Website display placement','Link to your campaign destination','Creative and scheduling review'],creative:'JPG, GIF or PNG; final placement and schedule confirmed by publisher.'};
 if(/Daily News/.test(c))return {summary:'Reach readers through Rubber World’s Daily News email.',spec:/500/.test(t)?'500 × 75 px':'190 px wide',includes:['Email advertising placement','Link to your campaign destination','Creative and send-date review'],creative:'JPG, GIF or PNG; confirm height and final delivery dates with publisher.'};
 if(/Industry Links/.test(c))return {summary:'Give your company an ongoing presence across Rubber World’s magazine and online industry directory.',spec:'Annual package',includes:['Half-page website profile in a selected issue','Magazine and Industry Links listings for one year','Homepage listing for one week'],creative:'Company profile, logo, website URL and preferred issue. Publisher confirms package terms.'};
 if(/Webinars/.test(c))return {summary:'Present your technical expertise through a webinar campaign for the rubber industry.',spec:'Custom webinar package',includes:['Webinar campaign planning','Registration destination','Follow-up reporting plan'],creative:'Topic, speakers, proposed date and registration URL. Webinar attendance data requires the hosting platform.'};
 if(/White Paper/.test(c))return {summary:'Promote useful technical content and connect interested readers to your download or enquiry page.',spec:'Custom content campaign',includes:['White-paper promotion plan','Download or enquiry destination','Configured conversion measurement'],creative:'White-paper PDF, title, short summary and destination URL.'};
 if(/Blue Book|Red Book/.test(c))return {summary:'Help buyers and technical teams discover your company in an industry reference publication.',spec:t,includes:['Selected reference-publication placement','Company or product information','Annual renewal visibility'],creative:'Supply your logo, company details and ad artwork. Confirm edition, dimensions and deadline with publisher.'};
 if(/Global Polymer/.test(c))return {summary:'Promote your company alongside coverage of the Global Polymer Summit.',spec:'Three-edition package · 2026 example',includes:['Selected show-publication ad format','Exhibitor campaign destination','Creative review'],creative:'Historical September 28–October 1, 2026 example. Future event dates and availability require publisher confirmation.'};
 return {summary:/Digital/.test(c)?'Connect readers of the digital magazine to your products, services or campaign page.':'Reach rubber-industry decision makers through the printed magazine.',spec:t,includes:['Selected issue and advertising placement','Creative review and campaign destination','Placement-level campaign measurement'],creative:/Digital/.test(c)?'Provide ad artwork and destination URL; confirm enhanced features with publisher.':'Provide high-resolution print artwork; final dimensions, color, bleed and deadline depend on the selected format.'};
}
module.exports={media,content,logo};
