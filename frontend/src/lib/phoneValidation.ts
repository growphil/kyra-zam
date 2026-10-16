import { Country, COUNTRIES, DEFAULT_COUNTRY, findCountryByCode } from "./countries";

export interface PhoneValidationResult {
  isValid: boolean;
  error: string | null;
  formattedFull: string; // E.164 string like "+919876543210"
}

export interface SmartPasteResult {
  nationalNumber: string;
  detectedCountry?: Country;
}

/**
 * Normalizes pasted phone input by extracting dial codes, stripping non-numeric formatting,
 * and preventing country-code duplication.
 */
export function normalizePastedPhone(pastedText: string, currentCountry: Country): SmartPasteResult {
  if (!pastedText) {
    return { nationalNumber: "" };
  }

  const trimmed = pastedText.trim();

  // Normalize international prefix "00" to "+"
  let raw = trimmed;
  if (raw.startsWith("00")) {
    raw = "+" + raw.slice(2);
  }

  // If text starts with a plus sign, check for matching country dial code
  if (raw.startsWith("+")) {
    const rawWithoutPlus = raw.slice(1);
    const digitsOnly = rawWithoutPlus.replace(/\D/g, "");

    // Sort countries by dial code length descending to match +971 before +9 etc.
    const sortedCountries = [...COUNTRIES].sort((a, b) => {
      const dialA = a.dialCode.replace(/\D/g, "");
      const dialB = b.dialCode.replace(/\D/g, "");
      return dialB.length - dialA.length;
    });

    for (const country of sortedCountries) {
      const dialDigits = country.dialCode.replace(/\D/g, "");
      if (digitsOnly.startsWith(dialDigits)) {
        const remaining = digitsOnly.slice(dialDigits.length);
        return {
          nationalNumber: remaining,
          detectedCountry: country
        };
      }
    }

    // Fallback: remove non-digits
    return { nationalNumber: digitsOnly };
  }

  // Handle local formats: extract pure digits
  let cleanDigits = raw.replace(/\D/g, "");

  // If India is selected, check if user pasted "+91" without "+" sign (e.g. 919876543210 where total is 12 digits)
  const currentDialDigits = currentCountry.dialCode.replace(/\D/g, "");
  if (
    cleanDigits.startsWith(currentDialDigits) &&
    cleanDigits.length === currentDialDigits.length + currentCountry.maxDigits
  ) {
    cleanDigits = cleanDigits.slice(currentDialDigits.length);
  }

  // If India / UK and 11 digits with leading 0 (e.g. 09876543210), strip leading zero
  if (
    (currentCountry.code === "IN" || currentCountry.code === "GB") &&
    cleanDigits.length === currentCountry.maxDigits + 1 &&
    cleanDigits.startsWith("0")
  ) {
    cleanDigits = cleanDigits.slice(1);
  }

  return {
    nationalNumber: cleanDigits
  };
}

/**
 * Validates a national phone number according to country rules.
 */
export function validatePhoneNumber(
  nationalNumber: string,
  country: Country,
  isRequired: boolean = true
): PhoneValidationResult {
  const cleanDigits = (nationalNumber || "").trim().replace(/\D/g, "");

  if (!cleanDigits) {
    if (isRequired) {
      return {
        isValid: false,
        error: "Phone number is required.",
        formattedFull: ""
      };
    }
    return {
      isValid: true,
      error: null,
      formattedFull: ""
    };
  }

  // Purity check: ensure no invalid non-digit characters were passed
  if (/\D/.test(nationalNumber.trim())) {
    return {
      isValid: false,
      error: "Phone number must contain digits only.",
      formattedFull: ""
    };
  }

  // Length check
  if (country.minDigits === country.maxDigits) {
    if (cleanDigits.length !== country.minDigits) {
      return {
        isValid: false,
        error: `Enter a valid ${country.minDigits}-digit phone number for ${country.name}.`,
        formattedFull: ""
      };
    }
  } else {
    if (cleanDigits.length < country.minDigits || cleanDigits.length > country.maxDigits) {
      return {
        isValid: false,
        error: `Enter a valid ${country.minDigits}–${country.maxDigits} digit phone number for ${country.name}.`,
        formattedFull: ""
      };
    }
  }

  // Regex prefix / mobile pattern check
  if (country.mobilePrefixRegex && !country.mobilePrefixRegex.test(cleanDigits)) {
    if (country.code === "IN") {
      return {
        isValid: false,
        error: "Enter a valid Indian mobile number starting with 6, 7, 8, or 9.",
        formattedFull: ""
      };
    }
    return {
      isValid: false,
      error: `Enter a valid phone number for ${country.name}.`,
      formattedFull: ""
    };
  }

  return {
    isValid: true,
    error: null,
    formattedFull: `${country.dialCode}${cleanDigits}`
  };
}

/**
 * Parses an existing stored phone string (e.g. "+919876543210" or "9876543210")
 * into its Country and National Number parts.
 */
export function parseStoredPhone(phoneStr: string | null | undefined): {
  country: Country;
  nationalNumber: string;
} {
  if (!phoneStr) {
    return { country: DEFAULT_COUNTRY, nationalNumber: "" };
  }

  const trimmed = phoneStr.trim();
  if (trimmed.startsWith("+")) {
    const rawWithoutPlus = trimmed.slice(1);
    const digitsOnly = rawWithoutPlus.replace(/\D/g, "");

    const sortedCountries = [...COUNTRIES].sort((a, b) => {
      const dialA = a.dialCode.replace(/\D/g, "");
      const dialB = b.dialCode.replace(/\D/g, "");
      return dialB.length - dialA.length;
    });

    for (const country of sortedCountries) {
      const dialDigits = country.dialCode.replace(/\D/g, "");
      if (digitsOnly.startsWith(dialDigits)) {
        return {
          country,
          nationalNumber: digitsOnly.slice(dialDigits.length)
        };
      }
    }
  }

  // Default fallback to India
  return {
    country: DEFAULT_COUNTRY,
    nationalNumber: trimmed.replace(/\D/g, "")
  };
}
