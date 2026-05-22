/**
 * passportSpecs.ts — built-in country passport/visa/ID photo presets (D-01).
 *
 * A single flat, searchable array (D-02). Each record carries full geometry
 * (D-03) plus D-04 sourcing metadata: `sourceUrl` points at a primary
 * government / standards domain, `sourceDate` is the ISO verification date.
 *
 * NOTE ON GEOMETRY (Pitfall 4): the mm bands below originate from
 * `01-RESEARCH.md`, compiled from secondary aggregators and cross-checked
 * against the primary government sources cited in each `sourceUrl`. They are
 * accurate enough for scaffolding and guide rendering, but tests assert shape
 * and invariants only — never exact mm — so a future spec correction does not
 * require a test rewrite. Re-verify against `sourceUrl` when specs drift.
 *
 * Generic presets (`generic-2x2in`, `generic-35x45mm`) intentionally omit
 * head/eye geometry — they provide an aspect-ratio crop without compliance
 * guidance. China's visa spec uses `topClearanceMm` instead of an eye-line.
 */
import type { PassportPreset } from './types';

/** ISO date these preset sources were checked (D-04). */
const SOURCE_DATE = '2026-05-21';

export const passportPresets = [
  {
    id: 'us-passport',
    displayName: 'USA Passport (2x2 in)',
    countryCode: 'US',
    outer: { widthMm: 51, heightMm: 51 },
    headHeightMm: { min: 25.4, max: 34.9 },
    eyeLineFromBottomMm: { min: 28.6, max: 34.9 },
    sourceUrl: 'https://travel.state.gov/content/travel/en/passports/how-apply/photos.html',
    sourceDate: SOURCE_DATE,
  },
  {
    id: 'uk-passport',
    displayName: 'UK Passport (35x45 mm)',
    countryCode: 'GB',
    outer: { widthMm: 35, heightMm: 45 },
    headHeightMm: { min: 29, max: 34 },
    eyeLineFromBottomMm: { min: 29, max: 34 },
    sourceUrl: 'https://www.gov.uk/photos-for-passports',
    sourceDate: SOURCE_DATE,
  },
  {
    id: 'schengen-visa',
    displayName: 'Schengen / EU Visa (35x45 mm)',
    countryCode: 'EU',
    outer: { widthMm: 35, heightMm: 45 },
    headHeightMm: { min: 32, max: 36 },
    eyeLineFromBottomMm: { min: 30, max: 36 },
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009R0810',
    sourceDate: SOURCE_DATE,
  },
  {
    id: 'india-passport',
    displayName: 'India Passport (51x51 mm)',
    countryCode: 'IN',
    outer: { widthMm: 51, heightMm: 51 },
    headHeightMm: { min: 35, max: 40 },
    eyeLineFromBottomMm: { min: 30, max: 36 },
    sourceUrl: 'https://www.passportindia.gov.in/',
    sourceDate: SOURCE_DATE,
  },
  {
    id: 'india-passport-35x45',
    displayName: 'India Passport (35x45 mm)',
    countryCode: 'IN',
    outer: { widthMm: 35, heightMm: 45 },
    headHeightMm: { min: 31, max: 36 },
    sourceUrl: 'https://www.passportindia.gov.in/',
    sourceDate: SOURCE_DATE,
  },
  {
    id: 'india-passport-35x35',
    displayName: 'India Passport (35x35 mm)',
    countryCode: 'IN',
    outer: { widthMm: 35, heightMm: 35 },
    headHeightMm: { min: 25, max: 30 },
    sourceUrl: 'https://www.passportindia.gov.in/',
    sourceDate: SOURCE_DATE,
  },
  {
    id: 'india-oci',
    displayName: 'India OCI (35x35 mm)',
    countryCode: 'IN',
    outer: { widthMm: 35, heightMm: 35 },
    headHeightMm: { min: 25, max: 30 },
    sourceUrl: 'https://ociservices.gov.in/',
    sourceDate: SOURCE_DATE,
  },
  {
    id: 'india-visa',
    displayName: 'India Visa (35x45 mm)',
    countryCode: 'IN',
    outer: { widthMm: 35, heightMm: 45 },
    headHeightMm: { min: 31, max: 36 },
    sourceUrl: 'https://indianvisaonline.gov.in/',
    sourceDate: SOURCE_DATE,
  },
  {
    id: 'india-pan-card',
    displayName: 'India PAN Card (25x35 mm)',
    countryCode: 'IN',
    outer: { widthMm: 25, heightMm: 35 },
    sourceUrl: 'https://www.incometax.gov.in/',
    sourceDate: SOURCE_DATE,
  },
  {
    id: 'canada-passport',
    displayName: 'Canada Passport (50x70 mm)',
    countryCode: 'CA',
    outer: { widthMm: 50, heightMm: 70 },
    headHeightMm: { min: 31, max: 36 },
    sourceUrl:
      'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports/photos.html',
    sourceDate: SOURCE_DATE,
  },
  {
    id: 'australia-passport',
    displayName: 'Australia Passport (35x45 mm)',
    countryCode: 'AU',
    outer: { widthMm: 35, heightMm: 45 },
    headHeightMm: { min: 32, max: 36 },
    sourceUrl: 'https://www.passports.gov.au/getting-passport-how-it-works/photo-guidelines',
    sourceDate: SOURCE_DATE,
  },
  {
    id: 'china-visa',
    displayName: 'China Visa (33x48 mm)',
    countryCode: 'CN',
    outer: { widthMm: 33, heightMm: 48 },
    headHeightMm: { min: 28, max: 33 },
    topClearanceMm: 7,
    sourceUrl: 'http://cs.mfa.gov.cn/zlbg/lsfw/zgqz/',
    sourceDate: SOURCE_DATE,
  },
  {
    id: 'generic-2x2in',
    displayName: 'Generic 2x2 in (51x51 mm)',
    countryCode: 'XX',
    outer: { widthMm: 51, heightMm: 51 },
    sourceUrl: 'https://www.icao.int/Security/FAL/TRIP/Pages/Publications.aspx',
    sourceDate: SOURCE_DATE,
  },
  {
    id: 'generic-35x45mm',
    displayName: 'Generic 35x45 mm',
    countryCode: 'XX',
    outer: { widthMm: 35, heightMm: 45 },
    sourceUrl: 'https://www.icao.int/Security/FAL/TRIP/Pages/Publications.aspx',
    sourceDate: SOURCE_DATE,
  },
] satisfies PassportPreset[];
