export interface Country {
  code: string; // ISO 2-letter code (e.g. IN, US, GB)
  name: string; // Country Name
  dialCode: string; // Dial Code with '+' (e.g. +91, +1)
  flag: string; // Emoji flag
  minDigits: number; // Minimum national number digits
  maxDigits: number; // Maximum national number digits
  mobilePrefixRegex?: RegExp; // Optional mobile start validation regex
  example: string;
}

// Comprehensive country database with priority ordering (India at top, followed by major global trade partners and alphabetized nations)
export const COUNTRIES: Country[] = [
  {
    code: "IN",
    name: "India",
    dialCode: "+91",
    flag: "🇮🇳",
    minDigits: 10,
    maxDigits: 10,
    mobilePrefixRegex: /^[6-9]\d{9}$/,
    example: "9876543210"
  },
  {
    code: "US",
    name: "United States",
    dialCode: "+1",
    flag: "🇺🇸",
    minDigits: 10,
    maxDigits: 10,
    mobilePrefixRegex: /^[2-9]\d{9}$/,
    example: "2025550123"
  },
  {
    code: "GB",
    name: "United Kingdom",
    dialCode: "+44",
    flag: "🇬🇧",
    minDigits: 10,
    maxDigits: 11,
    mobilePrefixRegex: /^7\d{9}$|^\d{10,11}$/,
    example: "7911123456"
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    dialCode: "+971",
    flag: "🇦🇪",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^5\d{8}$|^\d{9}$/,
    example: "501234567"
  },
  {
    code: "SA",
    name: "Saudi Arabia",
    dialCode: "+966",
    flag: "🇸🇦",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^5\d{8}$|^\d{9}$/,
    example: "512345678"
  },
  {
    code: "SG",
    name: "Singapore",
    dialCode: "+65",
    flag: "🇸🇬",
    minDigits: 8,
    maxDigits: 8,
    mobilePrefixRegex: /^[89]\d{7}$|^\d{8}$/,
    example: "81234567"
  },
  {
    code: "AU",
    name: "Australia",
    dialCode: "+61",
    flag: "🇦🇺",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^4\d{8}$|^\d{9}$/,
    example: "412345678"
  },
  {
    code: "CA",
    name: "Canada",
    dialCode: "+1",
    flag: "🇨🇦",
    minDigits: 10,
    maxDigits: 10,
    mobilePrefixRegex: /^[2-9]\d{9}$/,
    example: "4165550123"
  },
  {
    code: "DE",
    name: "Germany",
    dialCode: "+49",
    flag: "🇩🇪",
    minDigits: 10,
    maxDigits: 11,
    mobilePrefixRegex: /^1[567]\d{8,9}$|^\d{10,11}$/,
    example: "15123456789"
  },
  {
    code: "FR",
    name: "France",
    dialCode: "+33",
    flag: "🇫🇷",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^[67]\d{8}$|^\d{9}$/,
    example: "612345678"
  },
  {
    code: "CN",
    name: "China",
    dialCode: "+86",
    flag: "🇨🇳",
    minDigits: 11,
    maxDigits: 11,
    mobilePrefixRegex: /^1[3-9]\d{9}$/,
    example: "13800138000"
  },
  {
    code: "JP",
    name: "Japan",
    dialCode: "+81",
    flag: "🇯🇵",
    minDigits: 10,
    maxDigits: 10,
    mobilePrefixRegex: /^[789]0\d{8}$|^\d{10}$/,
    example: "9012345678"
  },
  {
    code: "QA",
    name: "Qatar",
    dialCode: "+974",
    flag: "🇶🇦",
    minDigits: 8,
    maxDigits: 8,
    mobilePrefixRegex: /^[3567]\d{7}$|^\d{8}$/,
    example: "33123456"
  },
  {
    code: "OM",
    name: "Oman",
    dialCode: "+968",
    flag: "🇴🇲",
    minDigits: 8,
    maxDigits: 8,
    mobilePrefixRegex: /^[79]\d{7}$|^\d{8}$/,
    example: "91234567"
  },
  {
    code: "KW",
    name: "Kuwait",
    dialCode: "+965",
    flag: "🇰🇼",
    minDigits: 8,
    maxDigits: 8,
    mobilePrefixRegex: /^[569]\d{7}$|^\d{8}$/,
    example: "51234567"
  },
  {
    code: "BH",
    name: "Bahrain",
    dialCode: "+973",
    flag: "🇧🇭",
    minDigits: 8,
    maxDigits: 8,
    mobilePrefixRegex: /^[36]\d{7}$|^\d{8}$/,
    example: "39123456"
  },
  {
    code: "MY",
    name: "Malaysia",
    dialCode: "+60",
    flag: "🇲🇾",
    minDigits: 9,
    maxDigits: 10,
    mobilePrefixRegex: /^1\d{8,9}$|^\d{9,10}$/,
    example: "123456789"
  },
  {
    code: "ID",
    name: "Indonesia",
    dialCode: "+62",
    flag: "🇮🇩",
    minDigits: 9,
    maxDigits: 12,
    mobilePrefixRegex: /^8\d{8,11}$|^\d{9,12}$/,
    example: "8123456789"
  },
  {
    code: "TH",
    name: "Thailand",
    dialCode: "+66",
    flag: "🇹🇭",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^[689]\d{8}$|^\d{9}$/,
    example: "812345678"
  },
  {
    code: "VN",
    name: "Vietnam",
    dialCode: "+84",
    flag: "🇻🇳",
    minDigits: 9,
    maxDigits: 10,
    mobilePrefixRegex: /^[35789]\d{8}$|^\d{9,10}$/,
    example: "912345678"
  },
  {
    code: "PH",
    name: "Philippines",
    dialCode: "+63",
    flag: "🇵🇭",
    minDigits: 10,
    maxDigits: 10,
    mobilePrefixRegex: /^9\d{9}$|^\d{10}$/,
    example: "9171234567"
  },
  {
    code: "ZA",
    name: "South Africa",
    dialCode: "+27",
    flag: "🇿🇦",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^[678]\d{8}$|^\d{9}$/,
    example: "712345678"
  },
  {
    code: "NG",
    name: "Nigeria",
    dialCode: "+234",
    flag: "🇳🇬",
    minDigits: 10,
    maxDigits: 10,
    mobilePrefixRegex: /^[789]\d{9}$|^\d{10}$/,
    example: "8031234567"
  },
  {
    code: "EG",
    name: "Egypt",
    dialCode: "+20",
    flag: "🇪🇬",
    minDigits: 10,
    maxDigits: 10,
    mobilePrefixRegex: /^1[0125]\d{8}$|^\d{10}$/,
    example: "1012345678"
  },
  {
    code: "KE",
    name: "Kenya",
    dialCode: "+254",
    flag: "🇰🇪",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^[71]\d{8}$|^\d{9}$/,
    example: "712345678"
  },
  {
    code: "BR",
    name: "Brazil",
    dialCode: "+55",
    flag: "🇧🇷",
    minDigits: 10,
    maxDigits: 11,
    mobilePrefixRegex: /^[1-9]{2}9?\d{8}$|^\d{10,11}$/,
    example: "11987654321"
  },
  {
    code: "MX",
    name: "Mexico",
    dialCode: "+52",
    flag: "🇲🇽",
    minDigits: 10,
    maxDigits: 10,
    mobilePrefixRegex: /^\d{10}$/,
    example: "5512345678"
  },
  {
    code: "RU",
    name: "Russia",
    dialCode: "+7",
    flag: "🇷🇺",
    minDigits: 10,
    maxDigits: 10,
    mobilePrefixRegex: /^9\d{9}$|^\d{10}$/,
    example: "9123456789"
  },
  {
    code: "IT",
    name: "Italy",
    dialCode: "+39",
    flag: "🇮🇹",
    minDigits: 9,
    maxDigits: 10,
    mobilePrefixRegex: /^3\d{8,9}$|^\d{9,10}$/,
    example: "3123456789"
  },
  {
    code: "ES",
    name: "Spain",
    dialCode: "+34",
    flag: "🇪🇸",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^[67]\d{8}$|^\d{9}$/,
    example: "612345678"
  },
  {
    code: "NL",
    name: "Netherlands",
    dialCode: "+31",
    flag: "🇳🇱",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^6\d{8}$|^\d{9}$/,
    example: "612345678"
  },
  {
    code: "SE",
    name: "Sweden",
    dialCode: "+46",
    flag: "🇸🇪",
    minDigits: 9,
    maxDigits: 10,
    mobilePrefixRegex: /^7\d{8}$|^\d{9,10}$/,
    example: "701234567"
  },
  {
    code: "CH",
    name: "Switzerland",
    dialCode: "+41",
    flag: "🇨🇭",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^7\d{8}$|^\d{9}$/,
    example: "791234567"
  },
  {
    code: "NZ",
    name: "New Zealand",
    dialCode: "+64",
    flag: "🇳🇿",
    minDigits: 8,
    maxDigits: 10,
    mobilePrefixRegex: /^2\d{7,9}$|^\d{8,10}$/,
    example: "211234567"
  },
  {
    code: "IE",
    name: "Ireland",
    dialCode: "+353",
    flag: "🇮🇪",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^8\d{8}$|^\d{9}$/,
    example: "871234567"
  },
  {
    code: "BD",
    name: "Bangladesh",
    dialCode: "+880",
    flag: "🇧🇩",
    minDigits: 10,
    maxDigits: 10,
    mobilePrefixRegex: /^1[3-9]\d{8}$|^\d{10}$/,
    example: "1712345678"
  },
  {
    code: "LK",
    name: "Sri Lanka",
    dialCode: "+94",
    flag: "🇱🇰",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^7\d{8}$|^\d{9}$/,
    example: "771234567"
  },
  {
    code: "NP",
    name: "Nepal",
    dialCode: "+977",
    flag: "🇳🇵",
    minDigits: 10,
    maxDigits: 10,
    mobilePrefixRegex: /^9[78]\d{8}$|^\d{10}$/,
    example: "9841234567"
  },
  {
    code: "PK",
    name: "Pakistan",
    dialCode: "+92",
    flag: "🇵🇰",
    minDigits: 10,
    maxDigits: 10,
    mobilePrefixRegex: /^3\d{9}$|^\d{10}$/,
    example: "3001234567"
  },
  {
    code: "TR",
    name: "Turkey",
    dialCode: "+90",
    flag: "🇹🇷",
    minDigits: 10,
    maxDigits: 10,
    mobilePrefixRegex: /^5\d{9}$|^\d{10}$/,
    example: "5321234567"
  },
  {
    code: "PL",
    name: "Poland",
    dialCode: "+48",
    flag: "🇵🇱",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^\d{9}$/,
    example: "501234567"
  },
  {
    code: "BE",
    name: "Belgium",
    dialCode: "+32",
    flag: "🇧🇪",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^4\d{8}$|^\d{9}$/,
    example: "470123456"
  },
  {
    code: "PT",
    name: "Portugal",
    dialCode: "+351",
    flag: "🇵🇹",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^9\d{8}$|^\d{9}$/,
    example: "912345678"
  },
  {
    code: "AT",
    name: "Austria",
    dialCode: "+43",
    flag: "🇦🇹",
    minDigits: 10,
    maxDigits: 11,
    mobilePrefixRegex: /^6\d{9,10}$|^\d{10,11}$/,
    example: "6641234567"
  },
  {
    code: "NO",
    name: "Norway",
    dialCode: "+47",
    flag: "🇳🇴",
    minDigits: 8,
    maxDigits: 8,
    mobilePrefixRegex: /^[49]\d{7}$|^\d{8}$/,
    example: "41234567"
  },
  {
    code: "DK",
    name: "Denmark",
    dialCode: "+45",
    flag: "🇩🇰",
    minDigits: 8,
    maxDigits: 8,
    mobilePrefixRegex: /^\d{8}$/,
    example: "20123456"
  },
  {
    code: "FI",
    name: "Finland",
    dialCode: "+358",
    flag: "🇫🇮",
    minDigits: 9,
    maxDigits: 10,
    mobilePrefixRegex: /^[45]\d{7,9}$|^\d{9,10}$/,
    example: "401234567"
  },
  {
    code: "IL",
    name: "Israel",
    dialCode: "+972",
    flag: "🇮🇱",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^5\d{8}$|^\d{9}$/,
    example: "501234567"
  },
  {
    code: "KR",
    name: "South Korea",
    dialCode: "+82",
    flag: "🇰🇷",
    minDigits: 9,
    maxDigits: 10,
    mobilePrefixRegex: /^1[0-9]\d{7,8}$|^\d{9,10}$/,
    example: "1012345678"
  },
  {
    code: "HK",
    name: "Hong Kong",
    dialCode: "+852",
    flag: "🇭🇰",
    minDigits: 8,
    maxDigits: 8,
    mobilePrefixRegex: /^[569]\d{7}$|^\d{8}$/,
    example: "91234567"
  },
  {
    code: "TW",
    name: "Taiwan",
    dialCode: "+886",
    flag: "🇹🇼",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^9\d{8}$|^\d{9}$/,
    example: "912345678"
  },
  {
    code: "AR",
    name: "Argentina",
    dialCode: "+54",
    flag: "🇦🇷",
    minDigits: 10,
    maxDigits: 10,
    mobilePrefixRegex: /^9\d{9}$|^\d{10}$/,
    example: "91123456789"
  },
  {
    code: "CL",
    name: "Chile",
    dialCode: "+56",
    flag: "🇨🇱",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^9\d{8}$|^\d{9}$/,
    example: "912345678"
  },
  {
    code: "CO",
    name: "Colombia",
    dialCode: "+57",
    flag: "🇨🇴",
    minDigits: 10,
    maxDigits: 10,
    mobilePrefixRegex: /^3\d{9}$|^\d{10}$/,
    example: "3001234567"
  },
  {
    code: "PE",
    name: "Peru",
    dialCode: "+51",
    flag: "🇵🇪",
    minDigits: 9,
    maxDigits: 9,
    mobilePrefixRegex: /^9\d{8}$|^\d{9}$/,
    example: "912345678"
  }
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // India (+91)

export function findCountryByCode(code: string): Country {
  return COUNTRIES.find(c => c.code.toUpperCase() === code.toUpperCase()) || DEFAULT_COUNTRY;
}

export function findCountryByDialCode(dialCode: string): Country | undefined {
  const normalized = dialCode.startsWith("+") ? dialCode : `+${dialCode}`;
  return COUNTRIES.find(c => c.dialCode === normalized);
}
