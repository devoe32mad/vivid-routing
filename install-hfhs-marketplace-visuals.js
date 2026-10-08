"use strict";
const fs = require("fs");
const path = require("path");

const MARKER = "/* HFHS marketplace visuals v2 */";

function install(source) {
  if (source.includes(MARKER)) return source;

  const helper = "\n" + MARKER + "\n" +
`function hfhsMarketplaceImage(opportunity) {
  const title = String(opportunity?.title || "").toLowerCase();

  if ((title.includes("pink ball") || title.includes("medallion"))) {
    return "https://www.henryford.com/-/media/project/hfhs/henryford/calendar/fundraising-events/pink-ball/pink-ball-save-the-date-2026-lg.jpg?extension=webp&hash=B07D8ABE8535DAC3CB9C7E6D024B691E";
  }

  if (
    title.includes("conference exhibit") ||
    title.includes("registration sponsor") ||
    title.includes("lanyard sponsor") ||\n    title.includes("networking break")
  ) {
    return "https://www.henryford.com/-/media/project/hfhs/henryford/images/content-images/henry-ford/hcp/med-ed/residencies-wyn/emergency-medicine/didactics-lecture.jpg?extension=webp&hash=D74BB9D42AE45836AA5351B5B2B8B70E";
  }

  if (
    title.includes("cme") ||
    title.includes("symposium") ||
    title.includes("session sponsor") ||
    title.includes("networking reception") ||\n    title.includes("breast oncology")
  ) {
    return "https://www.henryford.com/-/media/project/hfhs/henryford/images/content-images/henry-ford/hcp/med-ed/residencies-wyn/emergency-medicine/didactics-practice.jpg?extension=webp&hash=C179435DEE8CA1677135921C0FB559D7";
  }

  if (
    title.includes("community") ||
    title.includes("screening") ||
    title.includes("wellness") ||
    title.includes("mobile health") ||\n    title.includes("family health fair")
  ) {
    return "https://www.henryford.com/-/media/project/hfhs/henryford/news/2026/hhdetroit.jpg?extension=webp&h=450&hash=131FAC73E953D0035031AB8FF9C52BB2&iar=0&w=600";
  }

  if (
    title.includes("destination") ||
    title.includes("arena") ||
    title.includes("youth health") ||\n    title.includes("pistons fit")
  ) {
    return "https://www.henryford.com/-/media/project/hfhs/henryford/images/content-images/henry-ford/campaign/future-of-health/foh-cta-hospital-groundbreaking.jpg?extension=webp&h=496&hash=FCB62CB7564B3DD9FCF631556419144C&iar=0&w=747";
  }

  return null;
}
`;

  const useStrict = '"use strict";';
  const insertionPoint = source.indexOf(useStrict);
  if (insertionPoint < 0) throw new Error("HFHS visual installer could not find use-strict marker.");

  let next =
    source.slice(0, insertionPoint + useStrict.length) +
    helper +
    source.slice(insertionPoint + useStrict.length);

  const old = 'src="/org-opportunity/${opportunity.id}/photo"';
  const matches = next.split(old).length - 1;
  if (matches < 1) throw new Error("HFHS visual installer could not find marketplace photo template.");

  const replacement =
    'src="${organization.slug === \'henry-ford-health-demo\' && hfhsMarketplaceImage(opportunity) ? hfhsMarketplaceImage(opportunity) : \'/org-opportunity/\' + opportunity.id + \'/photo\'}"';

  next = next.split(old).join(replacement);

  // HFHS_CENTER_IMAGES_V2 — keep marketplace photography centered and consistently cropped.
  next = next.replace(
    /(<img[^>]+src="\$\{organization\.slug === 'henry-ford-health-demo'[\s\S]*?style=")([^"]*)(")/g,
    (match, start, style, end) => {
      let cleaned = style.replace(/object-position\s*:[^;]+;?/gi, "");
      if (!/object-fit\s*:/i.test(cleaned)) cleaned += "object-fit:cover;";
      return start + cleaned + "object-position:center center;" + end;
    }
  );
  return next;
}

function main() {
  const filename = path.join(__dirname, "server.js");
  try {
    const source = fs.readFileSync(filename, "utf8");
    const next = install(source);
    if (next !== source) {
      fs.writeFileSync(filename, next);
      console.log("HFHS marketplace visuals installed.");
    } else {
      console.log("HFHS marketplace visuals already installed.");
    }
  } catch (error) {
    console.error("HFHS marketplace visual enhancement skipped:", error.message);
  }
}

if (require.main === module) main();
module.exports = { install };
