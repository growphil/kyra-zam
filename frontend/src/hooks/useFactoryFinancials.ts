"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface FactoryFinancialSettings {
  defaultPaymentTerms: string;
  defaultAdvancePercentage: number;
  defaultFreightAmount: number;
  defaultHandlingCharge: number;
  defaultTaxRate: number;
  defaultQuotationValidityDays: number;
  defaultCurrency: string;
  minimumOrderValue: number;
  shippingCalculationMethod: string;
  freeShippingThreshold: number;
  defaultShippingCarrier: string;
  shippingTaxRate: number;
  estimatedDeliveryLeadDays: number;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  branch?: string;
  swiftCode?: string;
  bankDetails?: string;
  updatedAt?: string;
}

export const getCurrencySymbol = (currency?: string): string => {
  if (!currency) return "ZK";
  switch (currency.trim().toUpperCase()) {
    case "ZMW":
      return "ZK";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "ZAR":
      return "R";
    case "INR":
      return "₹";
    case "CNY":
    case "RMB":
      return "¥";
    case "JPY":
      return "¥";
    default:
      return currency;
  }
};

export const formatMoneyWithSymbol = (amount: number | string | undefined | null, symbol: string = "ZK"): string => {
  const num = typeof amount === "number" ? amount : parseFloat(String(amount || 0));
  if (isNaN(num)) return `${symbol} 0.00`;
  return `${symbol} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function useFactoryFinancials() {
  const { data, isLoading, isError, refetch } = useQuery<FactoryFinancialSettings>({
    queryKey: ["admin-factory-financial"],
    queryFn: async () => {
      try {
        const res = await api.get("/admin/factory/financial-settings");
        return res.data;
      } catch (err) {
        // Fallback to top-level endpoint if admin path 403s for non-admin
        const res = await api.get("/factory-settings/financial");
        return res.data;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache; auto-invalidated by RealtimeProvider
    refetchOnWindowFocus: false,
  });

  const currency = data?.defaultCurrency || "ZMW";
  const currencySymbol = getCurrencySymbol(currency);
  const taxRate = data?.defaultTaxRate ?? 16;
  const paymentTerms = data?.defaultPaymentTerms || "100% Advance";
  const advancePercentage = data?.defaultAdvancePercentage ?? 100;
  const quotationValidityDays = data?.defaultQuotationValidityDays ?? 30;
  const minimumOrderValue = data?.minimumOrderValue ?? 0;
  const freightAmount = data?.defaultFreightAmount ?? 0;
  const handlingCharge = data?.defaultHandlingCharge ?? 0;
  const freeShippingThreshold = data?.freeShippingThreshold ?? 0;
  const shippingCarrier = data?.defaultShippingCarrier || "Standard Road Logistics";
  const shippingCalculationMethod = data?.shippingCalculationMethod || "FLAT_RATE";
  const shippingTaxRate = data?.shippingTaxRate ?? taxRate;
  const estimatedDeliveryLeadDays = data?.estimatedDeliveryLeadDays ?? 3;
  const bankName = data?.bankName || "";
  const accountName = data?.accountName || "";
  const accountNumber = data?.accountNumber || "";
  const branch = data?.branch || "";
  const swiftCode = data?.swiftCode || "";
  const bankDetails = data?.bankDetails || "";

  const formatMoney = (amount: number | string | undefined | null) => {
    return formatMoneyWithSymbol(amount, currencySymbol);
  };

  const formatCurrency = (amount: number | string | undefined | null) => {
    const num = typeof amount === "number" ? amount : parseFloat(String(amount || 0));
    if (isNaN(num)) return `${currency} 0.00`;
    return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return {
    settings: data,
    currency,
    currencySymbol,
    taxRate,
    paymentTerms,
    advancePercentage,
    quotationValidityDays,
    minimumOrderValue,
    freightAmount,
    handlingCharge,
    freeShippingThreshold,
    shippingCarrier,
    shippingCalculationMethod,
    shippingTaxRate,
    estimatedDeliveryLeadDays,
    bankName,
    accountName,
    accountNumber,
    branch,
    swiftCode,
    bankDetails,
    formatMoney,
    formatCurrency,
    isLoading,
    isError,
    refetch,
  };
}
