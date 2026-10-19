'use strict';

const dns = require('node:dns').promises;
const net = require('node:net');

const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_DETAIL_PAGES = 8;
const DISCOVERY_PATTERN = /advertis|sponsor|media[ -]?kit|exhibit|partner|publication|magazine|newsletter|event|golf|gala|booth|vendor/i;

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value) {
  return decodeHtml(String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

function attribute(tag, name) {
  const match = String(tag || '').match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return decodeHtml(match ? (match[1] ?? match[2] ?? match[3] ?? '') : '');
}

function isBlockedAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (net.isIP(address) === 6) {
    const normalized = address.toLowerCase();
    const mappedV4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedV4) return isBlockedAddress(mappedV4[1]);
    return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb');
  }
  return true;
}

async function validatePublicUrl(input) {
  let url;
  try {
    url = new URL(String(input || '').trim());
  } catch {
    throw new Error('Enter a complete public website URL, including https://.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only public HTTP and HTTPS websites can be analyzed.');
  if (url.username || url.password) throw new Error('Website URLs containing credentials are not accepted.');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Only standard website ports can be analyzed.');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) throw new Error('Local and private network addresses are not accepted.');
  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(item => isBlockedAddress(item.address))) throw new Error('The website must resolve only to public internet addresses.');
  return url;
}

async function fetchPublicHtml(input) {
  let current = await validatePublicUrl(input);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'VividDemoBuilder/1.0 (+https://vividspots.com/)' }
      });
    } catch (error) {
      throw new Error(error.name === 'AbortError' ? 'The website did not respond within 10 seconds.' : 'The public website could not be reached.');
    } finally {
      clearTimeout(timer);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirect === MAX_REDIRECTS) throw new Error('The website redirected too many times.');
      const location = response.headers.get('location');
      if (!location) throw new Error('The website returned an incomplete redirect.');
      current = await validatePublicUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`The website returned HTTP ${response.status}.`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) throw new Error('The supplied URL must be a public HTML page. Media-kit PDFs can be discovered from that page.');
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_BYTES) throw new Error('The website page is too large to analyze safely.');
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        throw new Error('The website page is too large to analyze safely.');
      }
      chunks.push(value);
    }
    return { html: Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8'), url: current };
  }
  throw new Error('The website could not be analyzed.');
}

function metaContent(html, key, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find(item => attribute(item, key).toLowerCase() === value.toLowerCase());
  return tag ? attribute(tag, 'content') : '';
}

function absoluteUrl(value, base) {
  try {
    const url = new URL(value, base);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter(item => {
    const value = key(item);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function firstMeaningfulParagraph(html) {
  const paragraphs = [...String(html || '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(match => stripTags(match[1]))
    .filter(text => text.length >= 45 && text.length <= 700);
  return paragraphs[0] || '';
}

function pageHeading(html) {
  const match = String(html || '').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripTags(match[1]) : '';
}

function discoverContacts(html) {
  const emailLinks = [...String(html || '').matchAll(/<a\b[^>]*href\s*=\s*(?:"mailto:([^"?]+)[^"]*"|'mailto:([^'?]+)[^']*')[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(match => {
      const email = decodeHtml(match[1] || match[2] || '').trim();
      const label = stripTags(match[3]);
      return { name: label && label.toLowerCase() !== email.toLowerCase() ? label : '', email };
    })
    .filter(item => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email));
  const telephoneLinks = [...String(html || '').matchAll(/<a\b[^>]*href\s*=\s*(?:"tel:([^"]+)"|'tel:([^']+)')[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(match => ({ name: stripTags(match[3]), phone: decodeHtml(match[1] || match[2] || '').trim() }))
    .filter(item => item.phone);
  return uniqueBy([...emailLinks, ...telephoneLinks], item => item.email || item.phone).slice(0, 10);
}

function discoverLogo(html, baseUrl) {
  const tags = String(html || '').match(/<img\b[^>]*>/gi) || [];
  const candidate = tags.find(tag => /logo/i.test(`${attribute(tag, 'alt')} ${attribute(tag, 'class')} ${attribute(tag, 'id')} ${attribute(tag, 'src')}`));
  return candidate ? absoluteUrl(attribute(candidate, 'src'), baseUrl) : '';
}

function categoryFor(value) {
  const text = String(value || '');
  if (/magazine|publication|newsletter|news clips|news & notes|jobline/i.test(text)) return 'Publication';
  if (/golf|gala|conference|event|exhibit|booth|trade.?show/i.test(text)) return 'Event';
  if (/website|digital|email|social/i.test(text)) return 'Digital advertising';
  if (/partner/i.test(text)) return 'Partnership';
  return 'Sponsorship';
}

function imageSource(tag) {
  const direct = attribute(tag, 'src') || attribute(tag, 'data-src') || attribute(tag, 'data-lazy-src');
  if (direct) return direct;
  const srcset = attribute(tag, 'srcset') || attribute(tag, 'data-srcset');
  return srcset.split(',')[0]?.trim().split(/\s+/)[0] || '';
}

function isUsableImageUrl(value, pageUrl) {
  if (!value || /(?:\{|\}|%7b|%7d)/i.test(value)) return false;
  try {
    const image = new URL(value);
    if (image.href === pageUrl.href) return false;
    const path = image.pathname.toLowerCase();
    return /\.(?:avif|gif|jpe?g|png|svg|webp)$/.test(path) || /(?:image|media|photo|logo|banner|thumb|upload)/i.test(path);
  } catch {
    return false;
  }
}

function discoverImages(html, baseUrl) {
  const candidates = [
    { src: metaContent(html, 'property', 'og:image'), width: 0, height: 0, priority: 0 },
    ...[...html.matchAll(/<img\b[^>]*>/gi)].map(match => ({
      src: imageSource(match[0]),
      width: Number(attribute(match[0], 'width') || 0),
      height: Number(attribute(match[0], 'height') || 0),
      priority: 1
    }))
  ].map(item => ({ ...item, url: absoluteUrl(item.src, baseUrl) }))
    .filter(item => isUsableImageUrl(item.url, baseUrl))
    .filter(item => !(item.width > 0 && item.width <= 2) && !(item.height > 0 && item.height <= 2))
    .filter(item => !/(?:pixel|tracking|analytics|\/collect(?:\?|$)|facebook\.com\/tr|doubleclick)/i.test(item.url))
    .map(item => ({ ...item, sameOrigin: new URL(item.url).origin === baseUrl.origin }))
    .sort((left, right) => left.priority - right.priority || Number(right.sameOrigin) - Number(left.sameOrigin));
  return uniqueBy(candidates, item => item.url).map(item => item.url).slice(0, 12);
}

function discoverOpportunities(html, baseUrl) {
  const anchors = [...html.matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi)].map(match => {
    const href = absoluteUrl(match[1] || match[2] || match[3], baseUrl);
    const label = stripTags(match[4]);
    return { href, label };
  });
  const discoveredLinks = uniqueBy(anchors.filter(item => item.href && DISCOVERY_PATTERN.test(`${item.label} ${item.href}`)), item => item.href).slice(0, 18);
  const headings = [...html.matchAll(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map(match => stripTags(match[2])).filter(text => text.length >= 4 && text.length <= 120);
  const priceMatches = uniqueBy([...stripTags(html).matchAll(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s*(?:per|\/)[ ]?(?:year|month|issue|event|day))?/gi)].map(match => match[0]), value => value).slice(0, 12);
  const candidateTitles = uniqueBy([
    ...discoveredLinks.map(item => item.label).filter(label => label.length >= 4 && label.length <= 100),
    ...headings.filter(heading => DISCOVERY_PATTERN.test(heading))
  ], value => value.toLowerCase()).slice(0, 12);
  const opportunities = candidateTitles.map((title, index) => {
    const source = discoveredLinks.find(item => item.label.toLowerCase() === title.toLowerCase()) || discoveredLinks[index] || { href: baseUrl.toString() };
    return {
      title,
      category: categoryFor(title),
      price: priceMatches[index] || 'Pricing requires review',
      sourceUrl: source.href,
      status: 'Draft — requires Vivid review'
    };
  });
  return { discoveredLinks, opportunities, priceMatches };
}

function describePage(html) {
  return metaContent(html, 'name', 'description') || metaContent(html, 'property', 'og:description') || firstMeaningfulParagraph(html);
}

function cleanBrandName(title, html, hostname) {
  const declared = metaContent(html, 'property', 'og:site_name') || metaContent(html, 'name', 'application-name');
  if (declared) return declared.slice(0, 140);
  const parts = String(title || '').split(/\s+[|–—-]\s+/).map(value => value.trim()).filter(Boolean);
  const useful = parts.find(value => !/^(home|welcome|advertis|sponsor)/i.test(value) && value.length <= 90);
  return (useful || parts[0] || hostname).slice(0, 140);
}

async function enrichOpportunity(link, fallbackImage, fallbackContact) {
  try {
    const { html, url } = await fetchPublicHtml(link.href);
    const heading = pageHeading(html);
    const titleTag = stripTags((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
    const images = discoverImages(html, url).filter(image => !/logo/i.test(image));
    const prices = uniqueBy([...stripTags(html).matchAll(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s*(?:per|\/)[ ]?(?:year|month|issue|event|day))?/gi)].map(match => match[0]), value => value);
    const contacts = discoverContacts(html);
    const title = (heading || link.label || titleTag || 'Advertising opportunity').slice(0, 140);
    return {
      title,
      description: (describePage(html) || `Public ${title.toLowerCase()} information from ${url.hostname}.`).slice(0, 1000),
      category: categoryFor(`${title} ${url.pathname}`),
      price: prices[0] || 'Pricing requires review',
      sourceUrl: url.toString(),
      imageUrl: images[0] || fallbackImage || '',
      responsibleRep: contacts[0]?.name || contacts[0]?.email || fallbackContact || 'Demo Sales Rep',
      status: 'Draft — requires Vivid review'
    };
  } catch {
    return {
      title: link.label.slice(0, 140),
      description: `Public ${link.label.toLowerCase()} source identified for review.`,
      category: categoryFor(`${link.label} ${link.href}`),
      price: 'Pricing requires review',
      sourceUrl: link.href,
      imageUrl: fallbackImage || '',
      responsibleRep: fallbackContact || 'Demo Sales Rep',
      status: 'Draft — requires Vivid review'
    };
  }
}

async function scrapeProspectWebsite(input) {
  const { html, url } = await fetchPublicHtml(input);
  const title = stripTags((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1]) || url.hostname;
  const description = describePage(html);
  const images = discoverImages(html, url);
  const discovery = discoverOpportunities(html, url);
  const contacts = discoverContacts(html);
  const fallbackContact = contacts[0]?.name || contacts[0]?.email || '';
  const detailLinks = discovery.discoveredLinks.slice(0, MAX_DETAIL_PAGES);
  const enriched = await Promise.all(detailLinks.map((link, index) => enrichOpportunity(link, images[index] || images[0] || '', fallbackContact)));
  const opportunities = uniqueBy([
    ...enriched,
    ...discovery.opportunities.map((item, index) => ({
      ...item,
      description: `Public ${item.title.toLowerCase()} source identified on ${url.hostname}.`,
      imageUrl: images[index] || images[0] || '',
      responsibleRep: fallbackContact || 'Demo Sales Rep'
    }))
  ], item => `${item.title.toLowerCase()}|${item.sourceUrl}`).slice(0, 16);
  return {
    sourceUrl: url.toString(),
    hostname: url.hostname,
    title,
    brandName: cleanBrandName(title, html, url.hostname),
    description,
    logoUrl: discoverLogo(html, url) || images[0] || '',
    images,
    contacts,
    ...discovery,
    opportunities,
    analyzedAt: new Date().toISOString()
  };
}

module.exports = { decodeHtml, discoverContacts, discoverImages, discoverOpportunities, isBlockedAddress, scrapeProspectWebsite, validatePublicUrl };
