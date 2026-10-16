import { validatePhoneNumber } from "./phoneValidation";
import { COUNTRIES } from "./countries";

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry"
];

export interface StructuredAddress {
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface CustomerFormData {
  type: "INDIVIDUAL" | "BUSINESS";
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  taxGst?: string;
  notes?: string;
  assignedUserId?: string;

  // Structured Billing Address
  billingLine1: string;
  billingLine2: string;
  billingLandmark: string;
  billingCity: string;
  billingState: string;
  billingCountry: string;
  billingPostalCode: string;

  // Structured Shipping Address
  shippingSameAsBilling: boolean;
  shippingLine1: string;
  shippingLine2: string;
  shippingLandmark: string;
  shippingCity: string;
  shippingState: string;
  shippingCountry: string;
  shippingPostalCode: string;
}

export function validateGstin(gstin: string): boolean {
  if (!gstin) return true;
  const clean = gstin.trim().toUpperCase();
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(clean);
}

export function validatePostalCode(postalCode: string, country: string): { isValid: boolean; error?: string } {
  if (!postalCode || !postalCode.trim()) {
    return { isValid: false, error: "Postal / PIN Code is required" };
  }
  const clean = postalCode.trim();
  if (country === "India" || country === "IN") {
    if (!/^\d{6}$/.test(clean)) {
      return { isValid: false, error: "Indian PIN code must be exactly 6 digits (e.g. 600122)" };
    }
  } else {
    if (clean.length < 2 || clean.length > 12) {
      return { isValid: false, error: "Postal code must be between 2 and 12 characters" };
    }
  }
  return { isValid: true };
}

export function validateContactPerson(name: string): { isValid: boolean; error?: string } {
  if (!name || !name.trim()) return { isValid: true };
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { isValid: false, error: "Contact person must be at least 2 characters" };
  }
  if (/\d/.test(trimmed)) {
    return { isValid: false, error: "Contact person cannot contain numbers" };
  }
  if (!/^[\p{L}\s'.-]+$/u.test(trimmed)) {
    return { isValid: false, error: "Contact person can only contain letters, spaces, hyphens, and apostrophes" };
  }
  return { isValid: true };
}

export function validateCustomerName(name: string, type: "INDIVIDUAL" | "BUSINESS"): { isValid: boolean; error?: string } {
  if (!name || !name.trim()) {
    return { isValid: false, error: type === "BUSINESS" ? "Company / Business Name is required" : "Customer Name is required" };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { isValid: false, error: "Name must be at least 2 characters" };
  }
  if (type === "INDIVIDUAL") {
    if (/\d/.test(trimmed)) {
      return { isValid: false, error: "Customer name cannot contain numbers" };
    }
    if (!/^[\p{L}\s'.-]+$/u.test(trimmed)) {
      return { isValid: false, error: "Customer name can only contain letters, spaces, hyphens, and apostrophes" };
    }
  } else {
    // Business name allows letters, numbers, &, ., -, ', /, (), commas
    if (!/^[\p{L}\p{N}\s&.'\-\/(),]+$/u.test(trimmed)) {
      return { isValid: false, error: "Company name contains invalid characters" };
    }
  }
  return { isValid: true };
}

export function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (!email || !email.trim()) {
    return { isValid: false, error: "Email Address is required" };
  }
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, error: "Enter a valid email address (e.g. sales@company.com)" };
  }
  return { isValid: true };
}

export function formatAddressString(line1: string, line2?: string, landmark?: string): string {
  return [line1?.trim(), line2?.trim(), landmark ? `Landmark: ${landmark.trim()}` : ""]
    .filter(Boolean)
    .join(", ");
}

export function parseAddressString(fullAddress: string): { line1: string; line2: string; landmark: string } {
  if (!fullAddress) return { line1: "", line2: "", landmark: "" };
  const parts = fullAddress.split(",").map(p => p.trim()).filter(Boolean);
  let landmark = "";
  const remainingParts: string[] = [];
  for (const part of parts) {
    if (part.toLowerCase().startsWith("landmark:")) {
      landmark = part.replace(/landmark:/i, "").trim();
    } else {
      remainingParts.push(part);
    }
  }
  const line1 = remainingParts[0] || "";
  const line2 = remainingParts.slice(1).join(", ") || "";
  return { line1, line2, landmark };
}
