// IANA time zone → ISO 3166-1 alpha-2 country.
//
// This is the one location signal that costs nothing: Intl reports the zone
// with no permission, on web as well as native, and a phone with automatic
// time follows you when you travel. It's the fallback when the native
// geocoders are unavailable (always, on web) or location was never granted.
//
// Zones not listed resolve to null, so the caller keeps its own fallback.
// Countries with a single zone dominate; multi-zone countries list the
// populated zones rather than every historical alias.
export const TIMEZONE_COUNTRY: Record<string, string> = {
  // Asia
  "Asia/Jakarta": "ID", "Asia/Pontianak": "ID", "Asia/Makassar": "ID", "Asia/Jayapura": "ID",
  "Asia/Kuala_Lumpur": "MY", "Asia/Kuching": "MY", "Asia/Singapore": "SG",
  "Asia/Bangkok": "TH", "Asia/Manila": "PH", "Asia/Ho_Chi_Minh": "VN", "Asia/Saigon": "VN",
  "Asia/Phnom_Penh": "KH", "Asia/Vientiane": "LA", "Asia/Yangon": "MM", "Asia/Rangoon": "MM",
  "Asia/Brunei": "BN", "Asia/Dili": "TL",
  "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Pyongyang": "KP",
  "Asia/Shanghai": "CN", "Asia/Chongqing": "CN", "Asia/Urumqi": "CN",
  "Asia/Hong_Kong": "HK", "Asia/Macau": "MO", "Asia/Taipei": "TW",
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Colombo": "LK", "Asia/Kathmandu": "NP",
  "Asia/Dhaka": "BD", "Asia/Thimphu": "BT", "Asia/Karachi": "PK", "Asia/Kabul": "AF",
  "Indian/Maldives": "MV",
  "Asia/Dubai": "AE", "Asia/Muscat": "OM", "Asia/Qatar": "QA", "Asia/Bahrain": "BH",
  "Asia/Kuwait": "KW", "Asia/Riyadh": "SA", "Asia/Aden": "YE", "Asia/Baghdad": "IQ",
  "Asia/Tehran": "IR", "Asia/Amman": "JO", "Asia/Beirut": "LB", "Asia/Damascus": "SY",
  "Asia/Jerusalem": "IL", "Asia/Tel_Aviv": "IL", "Asia/Gaza": "PS", "Asia/Hebron": "PS",
  "Asia/Yerevan": "AM", "Asia/Baku": "AZ", "Asia/Tbilisi": "GE",
  "Asia/Almaty": "KZ", "Asia/Aqtobe": "KZ", "Asia/Bishkek": "KG", "Asia/Dushanbe": "TJ",
  "Asia/Ashgabat": "TM", "Asia/Tashkent": "UZ", "Asia/Ulaanbaatar": "MN",

  // Europe
  "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Lisbon": "PT", "Atlantic/Azores": "PT",
  "Europe/Madrid": "ES", "Atlantic/Canary": "ES", "Europe/Paris": "FR", "Europe/Monaco": "MC",
  "Europe/Brussels": "BE", "Europe/Amsterdam": "NL", "Europe/Luxembourg": "LU",
  "Europe/Berlin": "DE", "Europe/Zurich": "CH", "Europe/Vienna": "AT", "Europe/Vaduz": "LI",
  "Europe/Rome": "IT", "Europe/Vatican": "VA", "Europe/San_Marino": "SM", "Europe/Malta": "MT",
  "Europe/Andorra": "AD", "Europe/Gibraltar": "GI",
  "Europe/Copenhagen": "DK", "Atlantic/Faroe": "FO", "Europe/Oslo": "NO",
  "Europe/Stockholm": "SE", "Europe/Helsinki": "FI", "Europe/Reykjavik": "IS",
  "Europe/Tallinn": "EE", "Europe/Riga": "LV", "Europe/Vilnius": "LT",
  "Europe/Warsaw": "PL", "Europe/Prague": "CZ", "Europe/Bratislava": "SK",
  "Europe/Budapest": "HU", "Europe/Ljubljana": "SI", "Europe/Zagreb": "HR",
  "Europe/Sarajevo": "BA", "Europe/Belgrade": "RS", "Europe/Podgorica": "ME",
  "Europe/Skopje": "MK", "Europe/Tirane": "AL", "Europe/Athens": "GR",
  "Europe/Sofia": "BG", "Europe/Bucharest": "RO", "Europe/Chisinau": "MD",
  "Europe/Kyiv": "UA", "Europe/Kiev": "UA", "Europe/Minsk": "BY",
  "Europe/Moscow": "RU", "Europe/Kaliningrad": "RU", "Europe/Samara": "RU",
  "Asia/Yekaterinburg": "RU", "Asia/Novosibirsk": "RU", "Asia/Krasnoyarsk": "RU",
  "Asia/Irkutsk": "RU", "Asia/Yakutsk": "RU", "Asia/Vladivostok": "RU",
  "Europe/Istanbul": "TR", "Asia/Istanbul": "TR", "Asia/Nicosia": "CY", "Europe/Nicosia": "CY",

  // Americas
  "America/New_York": "US", "America/Detroit": "US", "America/Chicago": "US",
  "America/Denver": "US", "America/Phoenix": "US", "America/Los_Angeles": "US",
  "America/Anchorage": "US", "Pacific/Honolulu": "US", "America/Puerto_Rico": "PR",
  "America/Toronto": "CA", "America/Montreal": "CA", "America/Winnipeg": "CA",
  "America/Edmonton": "CA", "America/Vancouver": "CA", "America/Halifax": "CA",
  "America/St_Johns": "CA",
  "America/Mexico_City": "MX", "America/Tijuana": "MX", "America/Monterrey": "MX",
  "America/Cancun": "MX", "America/Merida": "MX",
  "America/Guatemala": "GT", "America/Belize": "BZ", "America/El_Salvador": "SV",
  "America/Tegucigalpa": "HN", "America/Managua": "NI", "America/Costa_Rica": "CR",
  "America/Panama": "PA", "America/Havana": "CU", "America/Jamaica": "JM",
  "America/Nassau": "BS", "America/Barbados": "BB", "America/Port_of_Spain": "TT",
  "America/Santo_Domingo": "DO", "America/Port-au-Prince": "HT",
  "America/Bogota": "CO", "America/Caracas": "VE", "America/Guyana": "GY",
  "America/Paramaribo": "SR", "America/Lima": "PE", "America/La_Paz": "BO",
  "America/Quito": "EC", "America/Guayaquil": "EC", "America/Santiago": "CL",
  "America/Asuncion": "PY", "America/Montevideo": "UY",
  "America/Argentina/Buenos_Aires": "AR", "America/Buenos_Aires": "AR",
  "America/Argentina/Cordoba": "AR", "America/Argentina/Mendoza": "AR",
  "America/Sao_Paulo": "BR", "America/Bahia": "BR", "America/Fortaleza": "BR",
  "America/Recife": "BR", "America/Manaus": "BR", "America/Belem": "BR",

  // Africa
  "Africa/Cairo": "EG", "Africa/Tripoli": "LY", "Africa/Tunis": "TN",
  "Africa/Algiers": "DZ", "Africa/Casablanca": "MA", "Africa/Khartoum": "SD",
  "Africa/Juba": "SS", "Africa/Addis_Ababa": "ET", "Africa/Nairobi": "KE",
  "Africa/Kampala": "UG", "Africa/Dar_es_Salaam": "TZ", "Africa/Kigali": "RW",
  "Africa/Mogadishu": "SO", "Africa/Lagos": "NG", "Africa/Accra": "GH",
  "Africa/Abidjan": "CI", "Africa/Dakar": "SN", "Africa/Bamako": "ML",
  "Africa/Ouagadougou": "BF", "Africa/Niamey": "NE", "Africa/Cotonou": "BJ",
  "Africa/Lome": "TG", "Africa/Conakry": "GN", "Africa/Banjul": "GM",
  "Africa/Douala": "CM", "Africa/Libreville": "GA", "Africa/Kinshasa": "CD",
  "Africa/Lubumbashi": "CD", "Africa/Luanda": "AO", "Africa/Lusaka": "ZM",
  "Africa/Harare": "ZW", "Africa/Maputo": "MZ", "Africa/Blantyre": "MW",
  "Africa/Gaborone": "BW", "Africa/Windhoek": "NA", "Africa/Johannesburg": "ZA",
  "Indian/Antananarivo": "MG", "Indian/Mauritius": "MU", "Indian/Mahe": "SC",

  // Oceania
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU",
  "Australia/Adelaide": "AU", "Australia/Perth": "AU", "Australia/Hobart": "AU",
  "Australia/Darwin": "AU",
  "Pacific/Auckland": "NZ", "Pacific/Fiji": "FJ", "Pacific/Port_Moresby": "PG",
  "Pacific/Guadalcanal": "SB", "Pacific/Efate": "VU", "Pacific/Noumea": "NC",
  "Pacific/Tahiti": "PF", "Pacific/Tongatapu": "TO", "Pacific/Apia": "WS",
  "Pacific/Guam": "GU",
};

/**
 * ISO 3166-1 alpha-2 country for the device's current time zone, or null when
 * the zone isn't recognised. Needs no permission and works on every platform.
 */
export function countryCodeFromTimezone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone ? (TIMEZONE_COUNTRY[zone] ?? null) : null;
  } catch {
    return null; // Intl unavailable or no zone reported.
  }
}
