import {
  normalizePhoneE164,
  scoreTemperature,
  type Temperature,
} from "@orbixlead/shared";
import type { ScrapeParams, ScrapedResult } from "./types.js";

const FIRST_NAMES = [
  "Padaria",
  "Barbearia",
  "Clínica",
  "Oficina",
  "Studio",
  "Mercado",
  "Farmácia",
  "Pet Shop",
  "Academia",
  "Restaurante",
  "Lavanderia",
  "Ótica",
  "Auto Peças",
  "Consultório",
  "Escola",
];

const SECOND_NAMES = [
  "São Jorge",
  "do Centro",
  "Nova Era",
  "Boa Vista",
  "Bom Sucesso",
  "Prime",
  "Express",
  "Brasil",
  "da Família",
  "Popular",
  "Premium",
  "Central",
  "Ideal",
  "Minas",
  "Paulista",
];

const DDDS = ["11", "21", "31", "41", "47", "48", "51", "61", "71", "81", "85", "92"];

const SOCIAL_POOL = [
  "https://instagram.com/",
  "https://facebook.com/",
  "https://www.linkedin.com/company/",
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]!;
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
}

function fakePhoneRaw(): string {
  const ddd = pick(DDDS);
  // ~70% mobile (11 digits), ~30% landline (10 digits)
  if (Math.random() < 0.7) {
    const rest = String(randInt(900000000, 999999999));
    return `(${ddd}) 9${rest.slice(1, 5)}-${rest.slice(5)}`;
  }
  const rest = String(randInt(20000000, 59999999));
  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

function fakeWebsite(companyName: string): string | null {
  if (Math.random() < 0.45) return null;
  const slug = slugify(companyName) || "empresa";
  const tlds = [".com.br", ".com", ".net.br"];
  return `https://www.${slug}${pick(tlds)}`;
}

function fakeSocials(companyName: string): string[] {
  if (Math.random() < 0.55) return [];
  const slug = slugify(companyName) || "empresa";
  const count = randInt(1, 2);
  const urls: string[] = [];
  const pool = [...SOCIAL_POOL];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = randInt(0, pool.length - 1);
    const base = pool.splice(idx, 1)[0]!;
    urls.push(`${base}${slug}`);
  }
  return urls;
}

function buildResult(
  companyName: string,
  phoneRaw: string | null,
  city: string
): ScrapedResult {
  const website = fakeWebsite(companyName);
  const socialUrls = fakeSocials(companyName);
  const rating = Math.round((Math.random() * 2 + 3) * 10) / 10; // 3.0–5.0
  const reviewCount = randInt(0, 220);
  const hasWebsite = Boolean(website);
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
    address: `Rua ${pick(SECOND_NAMES)}, ${randInt(10, 999)} — ${city}`,
    website,
    socialUrls,
    hasWebsite,
  };
}

/**
 * Generates N fake BR businesses for Fatia 3 / local dev.
 * Includes some without phone (API discards) and some duplicate phones.
 */
export async function scrapeMock(params: ScrapeParams): Promise<ScrapedResult[]> {
  const { city, segment, quantity } = params;
  const n = Math.max(1, Math.min(quantity, 100));
  const results: ScrapedResult[] = [];
  const phonesForDup: string[] = [];

  for (let i = 0; i < n; i++) {
    const companyName = `${pick(FIRST_NAMES)} ${pick(SECOND_NAMES)} ${segment}`.trim();

    let phoneRaw: string | null = null;

    // ~12% without phone → API must discard
    if (Math.random() >= 0.12) {
      // ~10% of remaining reuse a previous phone → duplicate
      if (phonesForDup.length > 0 && Math.random() < 0.1) {
        phoneRaw = pick(phonesForDup);
      } else {
        phoneRaw = fakePhoneRaw();
        phonesForDup.push(phoneRaw);
      }
    }

    results.push(buildResult(companyName, phoneRaw, city));
  }

  return results;
}
