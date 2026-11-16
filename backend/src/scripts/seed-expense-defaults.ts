import { PrismaClient, Prisma } from "../generated/client";

export const INITIAL_EXPENSE_CATEGORIES = [
  { name: "Office Rent", description: "Office premise lease and rental fees" },
  { name: "Electricity", description: "Utility power supply charges for office and plant" },
  { name: "Water", description: "Water utility bills" },
  { name: "Internet & Communication", description: "Broadband, mobile data and communication" },
  { name: "Employee Salaries", description: "Staff wages and contractual salaries" },
  { name: "Employee Allowances", description: "Transport, meal, and housing allowances" },
  { name: "Travel Expenses", description: "Official travel and field commute costs" },
  { name: "Accommodation", description: "Hotel and lodging expenses for staff" },
  { name: "Transportation", description: "Logistics, freight and delivery transport" },
  { name: "Fuel", description: "Vehicle fuel and generator fuel charges" },
  { name: "Vehicle Maintenance", description: "Servicing, tires and vehicle repairs" },
  { name: "Equipment Purchase", description: "Tools, capital machinery and test rigs" },
  { name: "Equipment Maintenance", description: "Tool calibration and machinery repairs" },
  { name: "Factory Expenses", description: "Shop floor consumables and operational costs" },
  { name: "Raw Material Expenses", description: "Direct materials and component procurement" },
  { name: "Office Supplies", description: "Stationery, printing, and administrative sundries" },
  { name: "Marketing & Advertising", description: "Promotional campaigns, branding, and ads" },
  { name: "Professional Fees", description: "Consulting, audit and accounting services" },
  { name: "Legal & Compliance", description: "Legal counsel, permits, and regulatory compliance" },
  { name: "Bank Charges", description: "Transfer commissions, forex fees and bank charges" },
  { name: "Government Fees", description: "Statutory levies, licensing and municipal fees" },
  { name: "Customs & Import Charges", description: "Customs clearing, port duties and tariffs" },
  { name: "Warehouse Expenses", description: "Storage, handling, pallets and racking" },
  { name: "Security Expenses", description: "Security personnel, guards, and surveillance" },
  { name: "Miscellaneous Expenses", description: "Sundry unplanned operational expenses" }
];

export async function seedExpenseDefaults(prisma: PrismaClient) {
  console.log("💰 Seeding 25 standard expense categories...");

  for (const cat of INITIAL_EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { name: cat.name },
      update: { description: cat.description, isActive: true },
      create: { name: cat.name, description: cat.description, isActive: true }
    });
  }
  console.log(`  ✓ ${INITIAL_EXPENSE_CATEGORIES.length} Expense categories ensured.`);

  // Ensure default threshold
  const existingActive = await prisma.expenseThreshold.findFirst({
    where: { isActive: true }
  });

  if (!existingActive) {
    // Find Superadmin user
    const superAdmin = await prisma.user.findFirst({
      where: { roles: { has: "SUPERADMIN" as any } }
    });

    if (superAdmin) {
      await prisma.expenseThreshold.create({
        data: {
          amount: new Prisma.Decimal(5000),
          currency: "ZMW",
          effectiveFrom: new Date(),
          isActive: true,
          createdById: superAdmin.id,
          changeReason: "Initial enterprise baseline threshold configuration (5,000 ZMW)"
        }
      });
      console.log("  ✓ Default expense auto-approval threshold set: 5,000 ZMW");
    }
  } else {
    console.log(`  ✓ Active expense threshold present: ${existingActive.amount.toString()} ${existingActive.currency}`);
  }
}
