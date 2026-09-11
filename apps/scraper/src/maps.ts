/**
 * Google Maps scraper (Playwright).
 *
 * WARNING: Maps DOM / selectors change often. This flow is intentionally simple
 * and resilient with fallbacks; when extraction fails entirely it throws so
 * BullMQ can retry (attempts configured by the API producer).
 */

import {
  normalizePhoneE164,
  scoreTemperature,
  type Temperature,
} from "@orbixlead/shared";
import { chromium, type Page } from "playwright";
import type { ScrapeParams, ScrapedResult } from "./types.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function humanDelay(minMs = 400, maxMs = 1400): Promise<void> {
  return sleep(minMs + Math.floor(Math.random() * (maxMs - minMs)));
}

function parseRating(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
}

function parseReviewCount(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/\./g, "").replace(/,/g, "");
  const m = cleaned.match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

async function dismissConsent(page: Page): Promise<void> {
  const selectors = [
    'button:has-text("Accept all")',
    'button:has-text("Aceitar tudo")',
    'button:has-text("Concordo")',
    'button:has-text("I agree")',
    'form[action*="consent"] button',
  ];
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click({ timeout: 2000 });
        await humanDelay(300, 800);
        return;
      }
    } catch {
      // ignore
    }
  }
}

async function textOrNull(page: Page, selectors: string[]): Promise<string | null> {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 800 })) {
        const t = (await el.innerText()).trim();
        if (t) return t;
      }
    } catch {
      // try next
    }
  }
  return null;
}

async function hrefOrNull(page: Page, selectors: string[]): Promise<string | null> {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 800 })) {
        const href = await el.getAttribute("href");
        if (href && !href.startsWith("http://www.google") && href !== "#") {
          return href;
        }
      }
    } catch {
      // try next
    }
  }
  return null;
}

async function extractPlace(page: Page, city: string): Promise<ScrapedResult | null> {
  const companyName = await textOrNull(page, [
    "h1.DUwDvf",
    "h1.fontHeadlineLarge",
    '[role="main"] h1',
  ]);
  if (!companyName) return null;

  const ratingText = await textOrNull(page, [
    'div.F7nice span[aria-hidden="true"]',
    'span[aria-label*="estrelas"]',
    'span[aria-label*="stars"]',
    ".fontDisplayLarge",
  ]);
  const reviewsText = await textOrNull(page, [
    'div.F7nice span[aria-label*="avalia"]',
    'div.F7nice span[aria-label*="review"]',
    'button[aria-label*="avalia"]',
    'button[aria-label*="review"]',
  ]);

  const address = await textOrNull(page, [
    'button[data-item-id="address"]',
    'button[data-item-id*="address"]',
    '[data-item-id="address"] .Io6YTe',
    'button[aria-label^="Endereço"]',
    'button[aria-label^="Address"]',
  ]);

  const phoneRaw = await textOrNull(page, [
    'button[data-item-id^="phone:"]',
    'button[data-item-id*="phone"] .Io6YTe',
    'button[aria-label^="Telefone"]',
    'button[aria-label^="Phone"]',
    'a[href^="tel:"]',
  ]);

  let website = await hrefOrNull(page, [
    'a[data-item-id="authority"]',
    'a[aria-label^="Website"]',
    'a[aria-label^="Site"]',
    'a[data-tooltip="Open website"]',
  ]);

  if (website?.startsWith("/url?")) {
    try {
      const u = new URL(website, "https://www.google.com");
      website = u.searchParams.get("q") ?? website;
    } catch {
      // keep as-is
    }
  }

  const rating = parseRating(ratingText);
  const reviewCount = parseReviewCount(reviewsText);
  const hasWebsite = Boolean(website);
  const socialUrls: string[] = [];
  const temperature: Temperature = scoreTemperature({
    rating,
    reviewCount,
    hasWebsite,
    socialCount: socialUrls.length,
  });

  const phoneE164 = phoneRaw ? normalizePhoneE164(phoneRaw) : null;

  return {
    companyName,
    phoneRaw,
    phoneE164,
    temperature,
    rating,
    reviewCount,
    city,
    address,
    website,
    socialUrls,
    hasWebsite,
  };
}

async function collectFeedHrefs(page: Page, limit: number): Promise<string[]> {
  const hrefs: string[] = [];
  const seen = new Set<string>();

  const feed = page.locator('div[role="feed"]').first();
  const feedVisible = await feed.isVisible({ timeout: 8000 }).catch(() => false);

  for (let round = 0; round < 12 && hrefs.length < limit; round++) {
    const links = page.locator('a[href*="/maps/place/"]');
    const count = await links.count();
    for (let i = 0; i < count && hrefs.length < limit; i++) {
      const href = await links.nth(i).getAttribute("href");
      if (!href) continue;
      const abs = href.startsWith("http") ? href : `https://www.google.com${href}`;
      if (seen.has(abs)) continue;
      seen.add(abs);
      hrefs.push(abs);
    }

    if (feedVisible) {
      await feed.evaluate((el) => {
        el.scrollTop += 600;
      });
      await humanDelay(500, 1100);
    } else {
      break;
    }
  }

  return hrefs.slice(0, limit);
}

/**
 * Basic Google Maps search: `${segment} in ${city}, Brazil`.
 * Throws on hard failure so BullMQ retries.
 */
export async function scrapeMaps(params: ScrapeParams): Promise<ScrapedResult[]> {
  const { city, segment, quantity } = params;
  const n = Math.max(1, Math.min(quantity, 100));
  const query = `${segment} in ${city}, Brazil`;

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      locale: "pt-BR",
      viewport: { width: 1365, height: 900 },
    });
    const page = await context.newPage();

    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await humanDelay(1200, 2200);
    await dismissConsent(page);
    await humanDelay(800, 1600);

    // Wait for results feed or a single place panel
    const hasFeed = await page
      .locator('div[role="feed"]')
      .first()
      .isVisible({ timeout: 15_000 })
      .catch(() => false);

    const results: ScrapedResult[] = [];
    const seenNames = new Set<string>();

    if (!hasFeed) {
      // Possibly landed on a single place
      const one = await extractPlace(page, city);
      if (!one) {
        throw new Error(`Maps: no feed and no place panel for query "${query}"`);
      }
      return [one];
    }

    const hrefs = await collectFeedHrefs(page, Math.min(n * 2, 40));
    if (hrefs.length === 0) {
      throw new Error(`Maps: zero place links for query "${query}"`);
    }

    for (const href of hrefs) {
      if (results.length >= n) break;
      try {
        await page.goto(href, { waitUntil: "domcontentloaded", timeout: 45_000 });
        await humanDelay(700, 1500);
        const item = await extractPlace(page, city);
        if (!item) continue;
        const key = item.companyName.toLowerCase();
        if (seenNames.has(key)) continue;
        seenNames.add(key);
        results.push(item);
      } catch {
        // skip fragile cards; continue
      }
    }

    if (results.length === 0) {
      throw new Error(`Maps: failed to extract any places for "${query}"`);
    }

    return results.slice(0, n);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
