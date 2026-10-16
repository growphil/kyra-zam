"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Country, COUNTRIES, DEFAULT_COUNTRY } from "@/lib/countries";
import { normalizePastedPhone } from "@/lib/phoneValidation";

export interface PhoneInputProps {
  id?: string;
  label?: string;
  required?: boolean;
  country: Country;
  phoneNumber: string;
  error?: string | null;
  placeholder?: string;
  disabled?: boolean;
  onCountryChange: (country: Country) => void;
  onPhoneChange: (phoneNumber: string) => void;
  onBlur?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  id,
  label,
  required = false,
  country = DEFAULT_COUNTRY,
  phoneNumber,
  error,
  placeholder,
  disabled = false,
  onCountryChange,
  onPhoneChange,
  onBlur,
  inputRef: externalInputRef
}) => {
  const autoId = useId();
  const inputId = id || autoId;
  const errorId = `${inputId}-error`;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const activeInputRef = externalInputRef || internalInputRef;

  // Filter countries by search query
  const filteredCountries = COUNTRIES.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.dialCode.includes(q)
    );
  });

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation inside dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      activeInputRef.current?.focus();
    }
  };

  // Handle phone input changes (accepts ONLY digits)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digitsOnly = rawVal.replace(/\D/g, "").slice(0, country.maxDigits);
    onPhoneChange(digitsOnly);
  };

  // Handle pasting into phone input
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    if (!pastedText) return;

    const { nationalNumber, detectedCountry } = normalizePastedPhone(pastedText, country);

    if (detectedCountry && detectedCountry.code !== country.code) {
      onCountryChange(detectedCountry);
      onPhoneChange(nationalNumber.slice(0, detectedCountry.maxDigits));
    } else {
      onPhoneChange(nationalNumber.slice(0, country.maxDigits));
    }
  };

  const handleSelectCountry = (selectedCountry: Country) => {
    onCountryChange(selectedCountry);
    setIsOpen(false);
    // Re-truncate phone number if new country maxDigits is smaller
    if (phoneNumber && phoneNumber.length > selectedCountry.maxDigits) {
      onPhoneChange(phoneNumber.slice(0, selectedCountry.maxDigits));
    }
    activeInputRef.current?.focus();
  };

  const dynamicPlaceholder = placeholder || (country.example ? `e.g. ${country.example}` : "Enter phone number");

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="block text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}

      <div className="relative flex items-center" ref={dropdownRef} onKeyDown={handleKeyDown}>
        {/* Country Selector Trigger Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`Select country code, currently ${country.name} (${country.dialCode})`}
          className={`flex items-center gap-1.5 px-3 py-2.5 bg-[#F4F9FF] border rounded-l-xl text-xs font-semibold text-[#0B2148] transition-all cursor-pointer select-none focus:outline-none focus:ring-1 focus:ring-accent/60 ${
            error
              ? "border-red-500/50 bg-red-500/[0.02]"
              : isOpen
              ? "border-accent/60 ring-1 ring-accent/60"
              : "border-[#D8E8FA] hover:border-[#D8E8FA]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span className="text-base leading-none" role="img" aria-label={country.name}>
            {country.flag}
          </span>
          <span className="font-mono text-[#0B2148]">{country.dialCode}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-[#526B91] transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {/* National Number Input Field */}
        <input
          ref={activeInputRef}
          id={inputId}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          value={phoneNumber}
          onChange={handleInputChange}
          onPaste={handlePaste}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={dynamicPlaceholder}
          maxLength={country.maxDigits}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`flex-1 min-w-0 bg-[#F4F9FF] border border-l-0 rounded-r-xl px-4 py-2.5 text-xs text-[#0B2148] placeholder-[#64748B] font-mono tracking-wider focus:outline-none focus:bg-white transition-colors ${
            error
              ? "border-red-500/50 bg-red-500/[0.02] focus:border-red-500"
              : "border-[#D8E8FA] focus:border-accent/60 focus:ring-1 focus:ring-accent/60"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        />

        {/* Country Picker Dropdown Menu */}
        {isOpen && (
          <div
            role="listbox"
            aria-label="Country selection list"
            className="absolute left-0 top-full mt-1.5 z-50 w-72 max-w-[90vw] bg-white border border-[#D8E8FA] rounded-2xl shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Search Box */}
            <div className="p-2 border-b border-[#D8E8FA] bg-[#F4F9FF] sticky top-0 z-10 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#526B91] ml-1.5 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country..."
                className="w-full bg-transparent border-none text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none py-1 pr-2"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1 text-[#526B91] hover:text-[#0B2148]"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Country Options List */}
            <div className="max-h-60 overflow-y-auto divide-y divide-[#E8F1FC] p-1">
              {filteredCountries.length > 0 ? (
                filteredCountries.map((c) => {
                  const isSelected = c.code === country.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectCountry(c)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors text-left cursor-pointer ${
                        isSelected
                          ? "bg-[#EAF5FF] text-[#0878F9] font-bold"
                          : "text-[#0B2148] hover:bg-[#F4F9FF] hover:text-[#0878F9]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-base flex-shrink-0" role="img" aria-label={c.name}>
                          {c.flag}
                        </span>
                        <span className="truncate">{c.name}</span>
                      </div>
                      <span className="font-mono text-[#526B91] text-[11px] ml-2 flex-shrink-0">
                        {c.dialCode}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="py-6 text-center text-xs text-[#526B91]">
                  No matching countries found
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Inline Error Message */}
      {error && (
        <p id={errorId} role="alert" className="text-[11px] font-medium text-red-400 flex items-center gap-1 mt-1">
          <span className="w-1 h-1 rounded-full bg-red-400 inline-block" />
          {error}
        </p>
      )}
    </div>
  );
};
