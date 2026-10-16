import { Country } from "./countries";
import { validatePhoneNumber } from "./phoneValidation";

export interface LeadFormState {
  name: string;
  companyName: string;
  email: string;
  phoneCountry: Country;
  phoneNumber: string;
  altPhoneCountry: Country;
  altPhoneNumber: string;
  source: string;
  priority: string;
  requirementSummary: string;
  notes: string;
  expectedFollowUpDate: string;
  assignedUserId: string;
}

export interface LeadFormErrors {
  name?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  source?: string;
  priority?: string;
  expectedFollowUpDate?: string;
}

// Regex allowing Unicode letters, spaces, apostrophes, hyphens, and periods
// Note: Requires at least 2 characters, at least one of which must be a letter.
const NAME_REGEX = /^[\p{L}\s'.-]{2,80}$/u;
const CONTAINS_LETTER_REGEX = /\p{L}/u;

// Regex for business company names: letters, numbers, spaces, and safe punctuation (&, ., -, ', /, (), +, ,)
const COMPANY_REGEX = /^[\p{L}\p{N}\s&.\-'/,()+#]{1,120}$/u;

// RFC-compliant email regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates Contact Name
 */
export function validateContactName(name: string): { isValid: boolean; error?: string; cleaned: string } {
  const cleaned = (name || "").replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return { isValid: false, error: "Contact Name is required.", cleaned: "" };
  }

  if (cleaned.length < 2) {
    return { isValid: false, error: "Contact Name must be at least 2 characters.", cleaned };
  }

  if (cleaned.length > 80) {
    return { isValid: false, error: "Contact Name must not exceed 80 characters.", cleaned };
  }

  if (/\d/.test(cleaned)) {
    return { isValid: false, error: "Contact Name cannot contain numbers.", cleaned };
  }

  if (!CONTAINS_LETTER_REGEX.test(cleaned) || !NAME_REGEX.test(cleaned)) {
    return { isValid: false, error: "Contact Name contains invalid characters. Only letters, spaces, hyphens (-), apostrophes ('), and periods (.) are allowed.", cleaned };
  }

  return { isValid: true, cleaned };
}

/**
 * Validates Company Name (optional)
 */
export function validateCompanyName(companyName: string): { isValid: boolean; error?: string; cleaned: string } {
  const cleaned = (companyName || "").replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return { isValid: true, cleaned: "" };
  }

  if (cleaned.length > 120) {
    return { isValid: false, error: "Company Name cannot exceed 120 characters.", cleaned };
  }

  if (!COMPANY_REGEX.test(cleaned)) {
    return { isValid: false, error: "Company Name contains invalid characters.", cleaned };
  }

  return { isValid: true, cleaned };
}

/**
 * Validates Email Address
 */
export function validateEmailAddress(email: string): { isValid: boolean; error?: string; cleaned: string } {
  const cleaned = (email || "").trim().toLowerCase();

  if (!cleaned) {
    return { isValid: false, error: "Email Address is required.", cleaned: "" };
  }

  if (!EMAIL_REGEX.test(cleaned)) {
    return { isValid: false, error: "Enter a valid email address (e.g. name@company.com).", cleaned };
  }

  return { isValid: true, cleaned };
}

/**
 * Validates the entire Lead form state and returns errors along with normalized payload.
 */
export function validateLeadForm(form: LeadFormState): {
  isValid: boolean;
  errors: LeadFormErrors;
  firstErrorField?: keyof LeadFormErrors;
  normalizedPayload?: {
    name: string;
    companyName: string | null;
    email: string;
    phone: string;
    alternatePhone: string | null;
    source: string;
    priority: string;
    requirementSummary: string | null;
    notes: string | null;
    expectedFollowUpDate: string | null;
    assignedUserId: string | null;
  };
} {
  const errors: LeadFormErrors = {};
  let firstErrorField: keyof LeadFormErrors | undefined;

  // 1. Name validation
  const nameRes = validateContactName(form.name);
  if (!nameRes.isValid) {
    errors.name = nameRes.error;
    if (!firstErrorField) firstErrorField = "name";
  }

  // 2. Company Name validation (optional)
  const companyRes = validateCompanyName(form.companyName);
  if (!companyRes.isValid) {
    errors.companyName = companyRes.error;
    if (!firstErrorField) firstErrorField = "companyName";
  }

  // 3. Email validation
  const emailRes = validateEmailAddress(form.email);
  if (!emailRes.isValid) {
    errors.email = emailRes.error;
    if (!firstErrorField) firstErrorField = "email";
  }

  // 4. Phone validation (required)
  const phoneRes = validatePhoneNumber(form.phoneNumber, form.phoneCountry, true);
  if (!phoneRes.isValid) {
    errors.phone = phoneRes.error || "Invalid phone number.";
    if (!firstErrorField) firstErrorField = "phone";
  }

  // 5. Alternate Phone validation (optional)
  let normalizedAltPhone: string | null = null;
  if (form.altPhoneNumber && form.altPhoneNumber.trim()) {
    const altPhoneRes = validatePhoneNumber(form.altPhoneNumber, form.altPhoneCountry, false);
    if (!altPhoneRes.isValid) {
      errors.alternatePhone = altPhoneRes.error || "Invalid alternate phone number.";
      if (!firstErrorField) firstErrorField = "alternatePhone";
    } else {
      normalizedAltPhone = altPhoneRes.formattedFull;
    }
  }

  // 6. Source validation
  if (!form.source || !form.source.trim()) {
    errors.source = "Lead Source is required.";
    if (!firstErrorField) firstErrorField = "source";
  }

  // 7. Priority validation
  if (!form.priority || !["LOW", "MEDIUM", "HIGH", "URGENT"].includes(form.priority)) {
    errors.priority = "Priority is required.";
    if (!firstErrorField) firstErrorField = "priority";
  }

  const isValid = Object.keys(errors).length === 0;

  if (!isValid) {
    return { isValid: false, errors, firstErrorField };
  }

  return {
    isValid: true,
    errors: {},
    normalizedPayload: {
      name: nameRes.cleaned,
      companyName: companyRes.cleaned || null,
      email: emailRes.cleaned,
      phone: phoneRes.formattedFull,
      alternatePhone: normalizedAltPhone,
      source: form.source.trim(),
      priority: form.priority,
      requirementSummary: form.requirementSummary ? form.requirementSummary.trim() || null : null,
      notes: form.notes ? form.notes.trim() || null : null,
      expectedFollowUpDate: form.expectedFollowUpDate || null,
      assignedUserId: form.assignedUserId || null
    }
  };
}
