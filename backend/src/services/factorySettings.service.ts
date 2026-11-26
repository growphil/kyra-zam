import { prisma } from "../prisma";
import { Prisma } from "../generated/client";

export interface FactoryFinancialSettingsDTO {
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
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  swiftCode: string;
  bankDetails: string;
  updatedAt?: Date;
}

export async function getFactoryFinancialSettings(): Promise<FactoryFinancialSettingsDTO> {
  let config = await prisma.factorySetting.findUnique({
    where: { id: "global" }
  });

  if (!config) {
    config = await prisma.factorySetting.create({
      data: {
        id: "global",
        defaultPaymentTerms: "100% Advance",
        defaultAdvancePercentage: new Prisma.Decimal("100.00"),
        defaultFreightAmount: new Prisma.Decimal("0.00"),
        defaultHandlingCharge: new Prisma.Decimal("0.00"),
        defaultTaxRate: new Prisma.Decimal("16.00"), // Default to Zambia standard VAT 16%
        defaultQuotationValidityDays: 30,
        defaultCurrency: "ZMW", // Default to ZMW (Zambian Kwacha) for KYRA ZAM
        minimumOrderValue: new Prisma.Decimal("0.00"),
        shippingCalculationMethod: "FLAT_RATE",
        freeShippingThreshold: new Prisma.Decimal("0.00"),
        defaultShippingCarrier: "Standard Road Logistics",
        shippingTaxRate: new Prisma.Decimal("16.00"),
        estimatedDeliveryLeadDays: 3,
        defaultUnitSystem: "METRIC",
        defaultTimezone: "Africa/Lusaka",
        workingHoursPerDay: new Prisma.Decimal("8.00"),
        productionDaysPerWeek: 6,
        defaultDeliveryTerms: "EXW - Ex Works",
        bankName: "Zambia National Commercial Bank (Zanaco)",
        accountName: "KYRA ZAM LIMITED",
        accountNumber: "1029384756",
        branch: "Lusaka Corporate Branch (010022)",
        swiftCode: "ZANAZMLX",
        bankDetails: "Please quote the Quotation Number as payment reference when remitting funds."
      }
    });
  }

  return {
    defaultPaymentTerms: config.defaultPaymentTerms || "100% Advance",
    defaultAdvancePercentage: Number(config.defaultAdvancePercentage ?? 100),
    defaultFreightAmount: Number(config.defaultFreightAmount ?? 0),
    defaultHandlingCharge: Number(config.defaultHandlingCharge ?? 0),
    defaultTaxRate: Number(config.defaultTaxRate ?? 16),
    defaultQuotationValidityDays: config.defaultQuotationValidityDays ?? 30,
    defaultCurrency: config.defaultCurrency || "ZMW",
    minimumOrderValue: Number(config.minimumOrderValue ?? 0),
    shippingCalculationMethod: (config as any).shippingCalculationMethod || "FLAT_RATE",
    freeShippingThreshold: Number((config as any).freeShippingThreshold || 0),
    defaultShippingCarrier: (config as any).defaultShippingCarrier || "Standard Road Logistics",
    shippingTaxRate: Number((config as any).shippingTaxRate || config.defaultTaxRate || 16),
    estimatedDeliveryLeadDays: (config as any).estimatedDeliveryLeadDays || 3,
    bankName: (config as any).bankName || "",
    accountName: (config as any).accountName || "",
    accountNumber: (config as any).accountNumber || "",
    branch: (config as any).branch || "",
    swiftCode: (config as any).swiftCode || "",
    bankDetails: (config as any).bankDetails || "",
    updatedAt: config.updatedAt
  };
}
