// ISO 3166-1 alpha-2 country → ISO 4217 currency.
//
// There's no JS API for this mapping (Intl can format a currency but can't tell
// you which one a country uses), so it has to be a table. Used to pre-fill the
// café form's currency from where the café actually is, rather than from the
// phone's region setting — see deviceCurrency() in utils/price.ts for the
// fallback when location is unavailable.
//
// Coverage is the euro zone plus commonly-travelled countries. Anything missing
// resolves to null and the caller keeps its existing fallback, so an absent
// entry degrades quietly instead of guessing wrong.
export const COUNTRY_CURRENCY: Record<string, string> = {
  // Euro zone
  AD: "EUR", AT: "EUR", BE: "EUR", CY: "EUR", DE: "EUR", EE: "EUR", ES: "EUR",
  FI: "EUR", FR: "EUR", GR: "EUR", HR: "EUR", IE: "EUR", IT: "EUR", LT: "EUR",
  LU: "EUR", LV: "EUR", MC: "EUR", MT: "EUR", NL: "EUR", PT: "EUR", SI: "EUR",
  SK: "EUR", SM: "EUR", VA: "EUR", ME: "EUR", XK: "EUR",

  // Rest of Europe
  AL: "ALL", BA: "BAM", BG: "BGN", BY: "BYN", CH: "CHF", CZ: "CZK", DK: "DKK",
  FO: "DKK", GB: "GBP", GE: "GEL", GI: "GIP", HU: "HUF", IS: "ISK", LI: "CHF",
  MD: "MDL", MK: "MKD", NO: "NOK", PL: "PLN", RO: "RON", RS: "RSD", RU: "RUB",
  SE: "SEK", UA: "UAH",

  // Asia
  AE: "AED", AF: "AFN", AM: "AMD", AZ: "AZN", BD: "BDT", BH: "BHD", BN: "BND",
  BT: "BTN", CN: "CNY", HK: "HKD", ID: "IDR", IL: "ILS", IN: "INR", IQ: "IQD",
  IR: "IRR", JO: "JOD", JP: "JPY", KG: "KGS", KH: "KHR", KP: "KPW", KR: "KRW",
  KW: "KWD", KZ: "KZT", LA: "LAK", LB: "LBP", LK: "LKR", MM: "MMK", MN: "MNT",
  MO: "MOP", MV: "MVR", MY: "MYR", NP: "NPR", OM: "OMR", PH: "PHP", PK: "PKR",
  PS: "ILS", QA: "QAR", SA: "SAR", SG: "SGD", SY: "SYP", TH: "THB", TJ: "TJS",
  TL: "USD", TM: "TMT", TR: "TRY", TW: "TWD", UZ: "UZS", VN: "VND", YE: "YER",

  // Oceania
  AU: "AUD", FJ: "FJD", GU: "USD", NC: "XPF", NZ: "NZD", PF: "XPF", PG: "PGK",
  SB: "SBD", TO: "TOP", VU: "VUV", WS: "WST",

  // Americas
  AR: "ARS", BB: "BBD", BO: "BOB", BR: "BRL", BS: "BSD", BZ: "BZD", CA: "CAD",
  CL: "CLP", CO: "COP", CR: "CRC", CU: "CUP", DO: "DOP", EC: "USD", GT: "GTQ",
  GY: "GYD", HN: "HNL", HT: "HTG", JM: "JMD", MX: "MXN", NI: "NIO", PA: "PAB",
  PE: "PEN", PR: "USD", PY: "PYG", SR: "SRD", SV: "USD", TT: "TTD", US: "USD",
  UY: "UYU", VE: "VES",

  // Africa
  AO: "AOA", BF: "XOF", BJ: "XOF", BW: "BWP", CD: "CDF", CI: "XOF", CM: "XAF",
  DZ: "DZD", EG: "EGP", ET: "ETB", GA: "XAF", GH: "GHS", GM: "GMD", GN: "GNF",
  KE: "KES", LY: "LYD", MA: "MAD", MG: "MGA", ML: "XOF", MU: "MUR", MW: "MWK",
  MZ: "MZN", NA: "NAD", NE: "XOF", NG: "NGN", RW: "RWF", SC: "SCR", SD: "SDG",
  SN: "XOF", SO: "SOS", SS: "SSP", TG: "XOF", TN: "TND", TZ: "TZS", UG: "UGX",
  ZA: "ZAR", ZM: "ZMW", ZW: "ZWL",
};

/**
 * Currency for an ISO 3166-1 alpha-2 country code, or null when the country
 * isn't in the table. Null (rather than a guessed default) lets callers keep
 * whatever fallback they already have.
 */
export function currencyForCountry(iso2?: string | null): string | null {
  if (!iso2) return null;
  return COUNTRY_CURRENCY[iso2.trim().toUpperCase()] ?? null;
}
