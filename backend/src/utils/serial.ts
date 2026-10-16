/**
 * Standardizes serial numbers across the platform to ensure case-insensitive matching 
 * and consistent formatting for industrial inventory control.
 */
export function normalizeSerial(s: string): string {
  if (!s) return "";
  
  // 1. Remove all non-alphanumeric characters except hyphens and dots, then uppercase
  let normalized = s.toUpperCase().replace(/[._\s]/g, "");
  
  // 2. Standardize RAW prefixes
  if (normalized.startsWith("RAW")) {
    normalized = "KZ-" + normalized;
  } else if (normalized.startsWith("KZRAW")) {
    normalized = normalized.replace("KZRAW", "KZ-RAW-");
  } 
  
  // 3. Ensure KZ-RAW- prefix for numeric-only or common raw formats if not already prefixed
  if (!normalized.startsWith("KZ-")) {
    // If it's just numbers or starts with RAW, try to prefix
    if (/^RAW|^00/.test(normalized) || (/^\d+$/.test(normalized) && normalized.length >= 3)) {
      normalized = "KZ-RAW-" + normalized.replace(/^RAW-?/, "");
    }
  }
  
  return normalized;
}
