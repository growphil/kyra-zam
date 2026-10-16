import { PrismaClient, Role, CellStatus, PaxStatus, SaleType, ServiceStatus, MaterialRequestStatus, TestStatus, ScrapType, ScrapSource, ScrapStatus, SeverityLevel, CustomerType, CustomerStatus, LeadStatus, LeadPriority, ActivityType, ActivityStatus, QuotationStatus, SalesOrderStatus, SalesOrderPaymentStatus, FulfillmentType, PurchaseRequestStatus, PurchaseRequestSource, PurchaseRequestPriority, PurchaseOrderStatus, GoodsReceiptStatus, StockMovementType, ProductionRequirementStatus, ProductionPlanStatus, WorkOrderStatus, ApprovalMethod } from "../generated/client";
import bcrypt from "bcryptjs";
import { FACTORY_DEMO_CATEGORIES, FACTORY_DEMO_MATERIALS } from "./seed-factory-demo-materials";

const prisma = new PrismaClient();

export async function seedCompleteEnterpriseDemo() {
  console.log("================================================================================");
  console.log("🔋 STARTING FULL ENTERPRISE DEMO SEEDING (10+ RECORDS PER ROLE) — KYRA ZAM 2.0");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // 1. Ensure Standard User Accounts & Roles
  // ---------------------------------------------------------------------------
  console.log("👥 [1/12] Ensuring 12 Role User Accounts...");

  const usersToEnsure = [
    { name: "Arjun Mehta", email: "superadmin@kyrazam.com", roles: [Role.SUPERADMIN], pass: "SuperAdmin@2025" },
    { name: "Priya Sharma", email: "admin@kyrazam.com", roles: [Role.ADMIN], pass: "Admin@2025" },
    { name: "Ravi Kumar", email: "inv@kyrazam.com", roles: [Role.INVENTORY_MANAGER], pass: "InvMgr@2025" },
    { name: "Sunita Patel", email: "test@kyrazam.com", roles: [Role.TEST_ENGINEER], pass: "TestEng@2025" },
    { name: "Deepak Nair", email: "asm@kyrazam.com", roles: [Role.ASSEMBLY_TECHNICIAN], pass: "AsmTech@2025" },
    { name: "Kiran Reddy", email: "paxtest@kyrazam.com", roles: [Role.PAX_TEST_ENGINEER], pass: "PaxTest@2025" },
    { name: "Meena Iyer", email: "super@kyrazam.com", roles: [Role.SUPERVISOR], pass: "Supervisor@2025" },
    { name: "Vikram Singh", email: "sales@kyrazam.com", roles: [Role.SALES_EXECUTIVE], pass: "SalesExec@2025" },
    { name: "Ananya Bose", email: "acct@kyrazam.com", roles: [Role.ACCOUNTANT], pass: "Accountant@2025" },
    { name: "Sanjay Gupta", email: "purchase@kyrazam.com", roles: [Role.PURCHASE_MANAGER], pass: "PurchMgr@2025" },
    { name: "Rohit Sharma", email: "marketing@kyrazam.com", roles: [Role.MARKETING_MANAGER], pass: "Marketing@2025" },
    { name: "Amit Patel", email: "qc@kyrazam.com", roles: [Role.QC], pass: "QcEngineer@2025" },
    { name: "Suresh Patel", email: "packing@kyrazam.com", roles: [Role.PACKING_OPERATOR], pass: "Packing@2025" }
  ];

  const userMap: Record<string, string> = {};

  for (const u of usersToEnsure) {
    const passwordHash = await bcrypt.hash(u.pass, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, roles: u.roles, passwordHash, isActive: true },
      create: { name: u.name, email: u.email, roles: u.roles, passwordHash, isActive: true }
    });
    userMap[u.roles[0]] = user.id;
    userMap[u.email] = user.id;
  }
  console.log(`  ✓ 12 Users Verified/Upserted.`);

  // ---------------------------------------------------------------------------
  // 2. Factory Settings, QC Thresholds, Service Master & Cell Masters
  // ---------------------------------------------------------------------------
  console.log("\n⚙️ [2/12] Seeding Factory Settings, QC Thresholds & Cell Masters...");

  await prisma.factorySetting.upsert({
    where: { id: "global" },
    update: {
      defaultPaymentTerms: "50% Advance, 50% on Dispatch",
      defaultAdvancePercentage: 50.0,
      defaultFreightAmount: 1200.0,
      defaultHandlingCharge: 450.0,
      defaultTaxRate: 18.0,
      defaultQuotationValidityDays: 30,
      defaultCurrency: "INR",
      minimumOrderValue: 15000.0,
      defaultUnitSystem: "METRIC",
      defaultTimezone: "Asia/Kolkata",
      workingHoursPerDay: 8.0,
      productionDaysPerWeek: 6,
      defaultDeliveryTerms: "EXW - Factory Gate Pune",
      updatedById: userMap[Role.SUPERADMIN]
    },
    create: {
      id: "global",
      defaultPaymentTerms: "50% Advance, 50% on Dispatch",
      defaultAdvancePercentage: 50.0,
      defaultFreightAmount: 1200.0,
      defaultHandlingCharge: 450.0,
      defaultTaxRate: 18.0,
      defaultQuotationValidityDays: 30,
      defaultCurrency: "INR",
      minimumOrderValue: 15000.0,
      defaultUnitSystem: "METRIC",
      defaultTimezone: "Asia/Kolkata",
      workingHoursPerDay: 8.0,
      productionDaysPerWeek: 6,
      defaultDeliveryTerms: "EXW - Factory Gate Pune",
      updatedById: userMap[Role.SUPERADMIN]
    }
  });

  await prisma.qcThreshold.upsert({
    where: { id: "global" },
    update: {
      ahMin: 2.8,
      ahMax: 3.6,
      irMin: 12.0,
      irMax: 42.0,
      serialDisplayLength: 12,
      updatedBy: "SuperAdmin"
    },
    create: {
      id: "global",
      ahMin: 2.8,
      ahMax: 3.6,
      irMin: 12.0,
      irMax: 42.0,
      serialDisplayLength: 12,
      updatedBy: "SuperAdmin"
    }
  });

  const cellMasters = [
    { cellSku: "CELL-LFP-3200", cellName: "LFP Cylindrical Cell 3.2V 3.2Ah (32650)", chemistry: "LFP", nominalVoltage: 3.2, nominalCapacity: 3.2, supplier: "Apex Lithium Tech", description: "Grade A 32650 Cylindrical Cell for High Cycle Life Packs" },
    { cellSku: "CELL-LFP-6000", cellName: "LFP Cylindrical Cell 3.2V 6.0Ah (32140)", chemistry: "LFP", nominalVoltage: 3.2, nominalCapacity: 6.0, supplier: "Bharat Cell Dynamics", description: "Heavy Duty 32140 Cell for EV Fleet & Energy Storage" },
    { cellSku: "CELL-NMC-50AH", cellName: "NMC Prismatic Cell 3.7V 50Ah", chemistry: "NMC", nominalVoltage: 3.7, nominalCapacity: 50.0, supplier: "SunPower Electronics", description: "High-Energy Density Prismatic Cell for Passenger 2W/3W" },
    { cellSku: "CELL-NMC-100AH", cellName: "NMC Prismatic Cell 3.7V 100Ah", chemistry: "NMC", nominalVoltage: 3.7, nominalCapacity: 100.0, supplier: "SunPower Electronics", description: "Ultra High Capacity Prismatic Cell for Commercial EV Bus/Truck" },
    { cellSku: "CELL-LTO-30AH", cellName: "LTO Ultra-Fast Charge Cell 2.4V 30Ah", chemistry: "LTO", nominalVoltage: 2.4, nominalCapacity: 30.0, supplier: "Apex Lithium Tech", description: "Extreme Cycle Life (>15,000 cycles) Sub-Zero Tolerant Cell" }
  ];

  for (const cm of cellMasters) {
    await prisma.cellMaster.upsert({
      where: { cellSku: cm.cellSku },
      update: cm,
      create: cm
    });
  }

  const servicePricings = [
    { serviceType: "Standard Battery Health Diagnostic", labourCost: 850.0, marginPercentage: 20.0, description: "Full cell balancing check, BMS communication scan and capacity test" },
    { serviceType: "Single Cell Replacement & Re-weld", labourCost: 1400.0, marginPercentage: 25.0, description: "Desoldering damaged cell, laser spot welding new cell and cycle check" },
    { serviceType: "BMS Board Replacement & Calibration", labourCost: 1950.0, marginPercentage: 22.0, description: "Swapping faulty BMS board, setting overvoltage/undervoltage thresholds" },
    { serviceType: "Enclosure Gasket & Waterproof Resealing", labourCost: 750.0, marginPercentage: 30.0, description: "IP67 gasket replacement and thermal dissipation gel replenishment" },
    { serviceType: "Busbar & High-Current Cable Rework", labourCost: 1200.0, marginPercentage: 25.0, description: "Replacing corroded busbars with nickel-plated copper bars" },
    { serviceType: "Full Battery Pack Re-conditioning", labourCost: 3500.0, marginPercentage: 20.0, description: "Complete teardown, cell matching, harness refresh and final QC report" }
  ];

  for (const sp of servicePricings) {
    await prisma.servicePricingMaster.upsert({
      where: { serviceType: sp.serviceType },
      update: sp,
      create: sp
    });
  }
  console.log("  ✓ Factory settings, QC Thresholds and Service Pricing master seeded.");

  // ---------------------------------------------------------------------------
  // 3. Categories, Materials Catalog & Warehouses
  // ---------------------------------------------------------------------------
  console.log("\n📦 [3/12] Seeding Categories, Materials Catalog, Warehouses & Stock Balances...");

  for (const cat of FACTORY_DEMO_CATEGORIES) {
    await prisma.materialCategory.upsert({
      where: { name: cat },
      update: {},
      create: { name: cat }
    });
  }

  const materialMap: Record<string, string> = {};

  for (const mat of FACTORY_DEMO_MATERIALS) {
    const created = await prisma.material.upsert({
      where: { sku: mat.sku },
      update: {
        name: mat.name,
        materialCode: mat.materialCode,
        category: mat.category,
        unit: mat.unit,
        description: mat.description,
        unitPrice: mat.baseCost,
        materialType: mat.materialType,
        isActive: mat.isActive,
        isPriceVerified: true,
        quantity: 500,
        totalValue: 500 * mat.baseCost,
        minStock: 25
      },
      create: {
        name: mat.name,
        materialCode: mat.materialCode,
        sku: mat.sku,
        category: mat.category,
        unit: mat.unit,
        description: mat.description,
        unitPrice: mat.baseCost,
        quantity: 500,
        totalValue: 500 * mat.baseCost,
        minStock: 25,
        materialType: mat.materialType,
        isActive: mat.isActive,
        isPriceVerified: true
      }
    });
    materialMap[mat.sku] = created.id;
  }

  // 4 Warehouses
  const warehousesData = [
    { code: "WH-RAW", name: "Central Raw Material Store", address: "Building A, Ground Floor, Gate 1, Chakan MIDC Pune" },
    { code: "WH-ASM", name: "Assembly Bay WIP Store", address: "Building A, Floor 1, Clean Room Bay 2, Chakan MIDC Pune" },
    { code: "WH-FG", name: "Finished Battery Pack Depot", address: "Building B, Dispatch Hub, Chakan MIDC Pune" },
    { code: "WH-SRV", name: "Service & RMA Quarantine Warehouse", address: "Building C, After-Sales Diagnostic Bay, Chakan MIDC Pune" }
  ];

  const warehouseMap: Record<string, string> = {};
  const locationMap: Record<string, string> = {};

  for (const wh of warehousesData) {
    const w = await prisma.warehouse.upsert({
      where: { code: wh.code },
      update: { name: wh.name, address: wh.address },
      create: { code: wh.code, name: wh.name, address: wh.address }
    });
    warehouseMap[wh.code] = w.id;
  }

  const locationsData = [
    { whCode: "WH-RAW", code: "RAW-A01", name: "Cell Quarantine & Inward Rack A1" },
    { whCode: "WH-RAW", code: "RAW-B02", name: "Busbars & Fasteners Rack B2" },
    { whCode: "WH-RAW", code: "RAW-C03", name: "BMS & Wiring Harness Cage C3" },
    { whCode: "WH-ASM", code: "ASM-BAY1", name: "Cell Matrix Sorting & Staging 1" },
    { whCode: "WH-ASM", code: "ASM-BAY2", name: "Laser Welding & BMS Soldering 2" },
    { whCode: "WH-ASM", code: "ASM-BAY3", name: "Casing & Potting Station 3" },
    { whCode: "WH-FG", code: "FG-STG01", name: "Ready For Dispatch - Pallet Bay 1" },
    { whCode: "WH-FG", code: "FG-STG02", name: "Tested & Approved Battery Vault 2" },
    { whCode: "WH-FG", code: "FG-EXP01", name: "Express Logistics Buffer 3" },
    { whCode: "WH-SRV", code: "SRV-INW", name: "Customer Inward RMA Intake" },
    { whCode: "WH-SRV", code: "SRV-WIP", name: "Diagnostic & Cell Balancing Bench" },
    { whCode: "WH-SRV", code: "SRV-SCR", name: "Scrap & Hazardous Disposal Bin" }
  ];

  for (const loc of locationsData) {
    const whId = warehouseMap[loc.whCode];
    const l = await prisma.warehouseLocation.upsert({
      where: { warehouseId_code: { warehouseId: whId, code: loc.code } },
      update: { name: loc.name },
      create: { warehouseId: whId, code: loc.code, name: loc.name }
    });
    locationMap[loc.code] = l.id;
  }

  // Populate Location balances for major materials
  for (const [sku, matId] of Object.entries(materialMap)) {
    await prisma.materialLocationBalance.upsert({
      where: {
        materialId_warehouseId_locationId: {
          materialId: matId,
          warehouseId: warehouseMap["WH-RAW"],
          locationId: locationMap["RAW-A01"]
        }
      },
      update: { quantity: 350 },
      create: {
        materialId: matId,
        warehouseId: warehouseMap["WH-RAW"],
        locationId: locationMap["RAW-A01"],
        quantity: 350
      }
    });

    await prisma.materialLocationBalance.upsert({
      where: {
        materialId_warehouseId_locationId: {
          materialId: matId,
          warehouseId: warehouseMap["WH-ASM"],
          locationId: locationMap["ASM-BAY1"]
        }
      },
      update: { quantity: 150 },
      create: {
        materialId: matId,
        warehouseId: warehouseMap["WH-ASM"],
        locationId: locationMap["ASM-BAY1"],
        quantity: 150
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Vendors, Production Stations, Pax Types & BOMs
  // ---------------------------------------------------------------------------
  console.log("\n🏭 [4/12] Seeding Vendors, Stations, PaxTypes & Bill of Materials (BOM)...");

  const vendorsData = [
    { name: "Apex Lithium Tech India Pvt Ltd", contact: "Suresh Menon", phone: "+91 98201 11223", email: "sales@apexlithium.in", address: "Plot 42, Electronic City Phase 1, Bengaluru 560100" },
    { name: "Bharat Cell Dynamics Corporation", contact: "Rameshwar Rao", phone: "+91 98450 33445", email: "orders@bharatcells.co.in", address: "GIDC Industrial Estate, Sector 28, Gandhinagar 382028" },
    { name: "SunPower Electronics Components", contact: "Nikhil Joshi", phone: "+91 98900 55667", email: "procurement@sunpowerindia.com", address: "MIDC Bhosari Industrial Area, Pune 411026" },
    { name: "NexGen Copper Conductors & Busbars", contact: "Manish Agarwal", phone: "+91 98112 77889", email: "sales@nexgencopper.com", address: "RIICO Industrial Area, Bhiwadi, Rajasthan 301019" },
    { name: "Delta Enclosures & Heavy Moulding", contact: "Karthik Subramanian", phone: "+91 94440 88990", email: "enquiry@deltaenclosures.in", address: "Ambattur Industrial Estate, Chennai 600058" },
    { name: "Precision Fasteners & Hardware Ltd", contact: "Gurpreet Singh", phone: "+91 98765 12340", email: "info@precisionfasteners.co", address: "Focal Point Phase 5, Ludhiana, Punjab 141010" },
    { name: "Thermal Shield Polymers & Insulations", contact: "Aniket Kulkarni", phone: "+91 98234 45678", email: "sales@thermalshield.co.in", address: "Sanand Industrial Park, Ahmedabad, Gujarat 382110" },
    { name: "Quantum Smart BMS Systems Pvt Ltd", contact: "Devendra Verma", phone: "+91 98180 90123", email: "bms-orders@quantumbms.in", address: "Okhla Industrial Area Phase 3, New Delhi 110020" }
  ];

  const vendorMap: Record<string, string> = {};
  for (const v of vendorsData) {
    const existing = await prisma.vendor.findFirst({ where: { name: v.name } });
    if (existing) {
      vendorMap[v.name] = existing.id;
    } else {
      const created = await prisma.vendor.create({ data: v });
      vendorMap[v.name] = created.id;
    }
  }

  // 6 Production Stations
  const stationsData = [
    { code: "STN-ASM-01", name: "Cell Sorter & Matrix Stacking Station", type: "ASSEMBLY" },
    { code: "STN-WELD-01", name: "High Precision Laser & Spot Welding Station", type: "ASSEMBLY" },
    { code: "STN-BMS-01", name: "BMS Integration & Wiring Harness Station", type: "ASSEMBLY" },
    { code: "STN-ENCL-01", name: "Enclosure Casing & Potting Station", type: "ASSEMBLY" },
    { code: "STN-QC-01", name: "Hi-Pot & Insulation Safety Testing Station", type: "TESTING" },
    { code: "STN-CYCL-01", name: "Automated Charge/Discharge Cycle Testing Station", type: "TESTING" }
  ];

  const stationMap: Record<string, string> = {};
  for (const st of stationsData) {
    const s = await prisma.productionStation.upsert({
      where: { code: st.code },
      update: { name: st.name, type: st.type, isActive: true },
      create: { code: st.code, name: st.name, type: st.type, isActive: true }
    });
    stationMap[st.code] = s.id;

    // Assign operators
    await prisma.stationOperatorAssignment.create({
      data: {
        stationId: s.id,
        operatorId: st.type === "ASSEMBLY" ? userMap[Role.ASSEMBLY_TECHNICIAN] : userMap[Role.TEST_ENGINEER],
        assignedAt: new Date()
      }
    });
  }

  // 6 Pax Types
  const paxTypesData = [
    { name: "24V 50Ah LFP E-Rickshaw Battery Pack", cellCount: 8, ahMin: 48.0, ahMax: 52.0, irMin: 15.0, irMax: 30.0, nominalVoltage: 24.0, nominalCapacity: 50.0, configuration: "8S1P", cellChemistry: "LFP", unitPrice: 28500.0, isProductionActive: true },
    { name: "48V 100Ah Solar ESS High-Capacity Pack", cellCount: 16, ahMin: 98.0, ahMax: 104.0, irMin: 12.0, irMax: 26.0, nominalVoltage: 48.0, nominalCapacity: 100.0, configuration: "16S1P", cellChemistry: "LFP", unitPrice: 58000.0, isProductionActive: true },
    { name: "60V 30Ah EV Scooter High-Rate NMC Pack", cellCount: 17, ahMin: 29.0, ahMax: 32.5, irMin: 18.0, irMax: 35.0, nominalVoltage: 60.0, nominalCapacity: 30.0, configuration: "17S1P", cellChemistry: "NMC", unitPrice: 34000.0, isProductionActive: true },
    { name: "72V 45Ah Delivery Fleet Heavy Duty Pack", cellCount: 20, ahMin: 44.0, ahMax: 47.5, irMin: 14.0, irMax: 28.0, nominalVoltage: 72.0, nominalCapacity: 45.0, configuration: "20S1P", cellChemistry: "LFP", unitPrice: 46000.0, isProductionActive: true },
    { name: "12V 100Ah Marine & Caravan Deep Cycle Pack", cellCount: 4, ahMin: 98.0, ahMax: 103.0, irMin: 10.0, irMax: 22.0, nominalVoltage: 12.0, nominalCapacity: 100.0, configuration: "4S1P", cellChemistry: "LFP", unitPrice: 18500.0, isProductionActive: true },
    { name: "48V 50Ah Telecom Tower Backup LFP Pack", cellCount: 15, ahMin: 49.0, ahMax: 53.0, irMin: 16.0, irMax: 32.0, nominalVoltage: 48.0, nominalCapacity: 50.0, configuration: "15S1P", cellChemistry: "LFP", unitPrice: 31000.0, isProductionActive: true }
  ];

  const paxTypeMap: Record<string, string> = {};
  for (const pt of paxTypesData) {
    const p = await prisma.paxType.upsert({
      where: { name: pt.name },
      update: { ...pt, createdBy: "SuperAdmin" },
      create: { ...pt, createdBy: "SuperAdmin" }
    });
    paxTypeMap[pt.name] = p.id;
  }

  // 6 BOMs with Items
  const bomsData = [
    {
      name: "BOM-24V-50AH: 24V 50Ah E-Rickshaw Pack",
      description: "Bill of materials for commercial 24V 50Ah 8S LFP battery pack",
      items: [
        { sku: "CELL-18650-50AH", qty: 8 },
        { sku: "BMS-8S-60A", qty: 1 },
        { sku: "BUS-CU-20MM", qty: 7 },
        { sku: "WIRE-8AWG-BLK", qty: 3 },
        { sku: "FAST-M4-BOLT", qty: 16 },
        { sku: "ENC-ABS-MD", qty: 1 },
        { sku: "THERM-PAD-1MM", qty: 2 },
        { sku: "LBL-BATT-WARN", qty: 1 }
      ]
    },
    {
      name: "BOM-48V-100AH: 48V 100Ah Solar Energy Storage",
      description: "Bill of materials for residential/commercial 48V 100Ah 16S LFP ESS unit",
      items: [
        { sku: "CELL-32140-100AH", qty: 16 },
        { sku: "BMS-16S-100A", qty: 1 },
        { sku: "BUS-NI-30MM", qty: 15 },
        { sku: "WIRE-6AWG-RED", qty: 5 },
        { sku: "FUSE-100A-ANL", qty: 1 },
        { sku: "ENC-AL-LG", qty: 1 },
        { sku: "THERM-PAD-2MM", qty: 4 },
        { sku: "LBL-QR-ID", qty: 1 }
      ]
    },
    {
      name: "BOM-60V-30AH: 60V 30Ah EV Scooter Pack",
      description: "High-power NMC battery pack for 2-wheeler electric vehicles",
      items: [
        { sku: "CELL-21700-60AH", qty: 17 },
        { sku: "BMS-16S-100A", qty: 1 },
        { sku: "BUS-CU-25MM", qty: 16 },
        { sku: "WIRE-8AWG-BLK", qty: 4 },
        { sku: "FUSE-60A-CAR", qty: 1 },
        { sku: "ENC-ABS-MD", qty: 1 },
        { sku: "THERM-PASTE-5W", qty: 1 },
        { sku: "LBL-DATE-PROD", qty: 1 }
      ]
    },
    {
      name: "BOM-72V-45AH: 72V 45Ah Delivery Fleet Pack",
      description: "Heavy duty battery pack for quick-commerce delivery e-scooters",
      items: [
        { sku: "CELL-18650-50AH", qty: 20 },
        { sku: "BMS-16S-100A", qty: 1 },
        { sku: "BUS-CU-25MM", qty: 19 },
        { sku: "WIRE-6AWG-RED", qty: 4 },
        { sku: "FUSE-60A-CAR", qty: 1 },
        { sku: "ENC-AL-LG", qty: 1 },
        { sku: "THERM-PAD-1MM", qty: 3 },
        { sku: "LBL-BATT-WARN", qty: 1 }
      ]
    },
    {
      name: "BOM-12V-100AH: 12V 100Ah Marine Deep Cycle",
      description: "Marine-grade waterproof deep cycle battery for trolling motors & yachts",
      items: [
        { sku: "CELL-32140-100AH", qty: 4 },
        { sku: "BMS-4S-40A", qty: 1 },
        { sku: "BUS-CU-20MM", qty: 3 },
        { sku: "WIRE-8AWG-BLK", qty: 2 },
        { sku: "FUSE-40A-BLD", qty: 1 },
        { sku: "ENC-ABS-SM", qty: 1 },
        { sku: "INS-FP-SHEET", qty: 2 },
        { sku: "LBL-QR-ID", qty: 1 }
      ]
    },
    {
      name: "BOM-48V-50AH: 48V 50Ah Telecom Backup Pack",
      description: "Reliable rack-mount LFP power pack for 4G/5G mobile tower stations",
      items: [
        { sku: "CELL-18650-50AH", qty: 15 },
        { sku: "BMS-16S-100A", qty: 1 },
        { sku: "BUS-CU-20MM", qty: 14 },
        { sku: "WIRE-6AWG-RED", qty: 4 },
        { sku: "ENC-AL-LG", qty: 1 },
        { sku: "THERM-PAD-2MM", qty: 2 },
        { sku: "LBL-DATE-PROD", qty: 1 }
      ]
    }
  ];

  const bomMap: Record<string, string> = {};
  for (const b of bomsData) {
    let bom = await prisma.bOM.findUnique({ where: { name: b.name } });
    if (!bom) {
      bom = await prisma.bOM.create({
        data: { name: b.name, description: b.description }
      });
    }
    bomMap[b.name] = bom.id;

    for (const item of b.items) {
      const matId = materialMap[item.sku];
      if (matId) {
        const existingItem = await prisma.bOMItem.findFirst({
          where: { bomId: bom.id, materialId: matId }
        });
        if (!existingItem) {
          await prisma.bOMItem.create({
            data: { bomId: bom.id, materialId: matId, quantity: item.qty }
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. CRM: 10 Customers, 10 Leads & 10 Activities
  // ---------------------------------------------------------------------------
  console.log("\n💼 [5/12] Seeding 10 CRM Customers, 10 Leads & 10 Activities...");

  const customersData = [
    { code: "CUS-000101", type: CustomerType.BUSINESS, name: "ElectroRide Mobility Pvt Ltd", contact: "Anand Verma", email: "procurement@electroride.in", phone: "+91 98200 11221", address: "Plot 18, Peenya Industrial Area 4th Phase", city: "Bengaluru", state: "Karnataka", country: "India", postalCode: "560058", gst: "29AABCE1234F1Z8" },
    { code: "CUS-000102", type: CustomerType.BUSINESS, name: "SuryaShakti Solar Solutions Ltd", contact: "Sunil Deshmukh", email: "orders@suryashakti-solar.com", phone: "+91 98220 33442", address: "Survey 45, Hadapsar Industrial Estate", city: "Pune", state: "Maharashtra", country: "India", postalCode: "411028", gst: "27AABCS5678K1Z3" },
    { code: "CUS-000103", type: CustomerType.BUSINESS, name: "GreenE-Rickshaw Fleet India", contact: "Gurmeet Singh", email: "fleet@greenerickshaw.co.in", phone: "+91 98110 55663", address: "B-24, Mayapuri Industrial Area Phase 1", city: "New Delhi", state: "Delhi", country: "India", postalCode: "110064", gst: "07AABCG9012L1Z5" },
    { code: "CUS-000104", type: CustomerType.BUSINESS, name: "AeroDrone Logistics Technologies", contact: "Dr. K. Seshadri", email: "hardware@aerodrone.ai", phone: "+91 98490 77884", address: "Hardware Park, Shamshabad Airport Road", city: "Hyderabad", state: "Telangana", country: "India", postalCode: "501218", gst: "36AABCA3456P1Z7" },
    { code: "CUS-000105", type: CustomerType.BUSINESS, name: "VoltCharge Fleet Operations Ltd", contact: "V. Ramaswamy", email: "fleetops@voltcharge.in", phone: "+91 98400 99005", address: "3rd Cross, Guindy Industrial Estate", city: "Chennai", state: "Tamil Nadu", country: "India", postalCode: "600032", gst: "33AABCV7890R1Z9" },
    { code: "CUS-000106", type: CustomerType.BUSINESS, name: "BlueMarine Nautical Works", contact: "Sebastian Joseph", email: "marine@bluemarinenautical.com", phone: "+91 98470 11236", address: "Willingdon Island Port Area", city: "Kochi", state: "Kerala", country: "India", postalCode: "682003", gst: "32AABCB2345T1Z1" },
    { code: "CUS-000107", type: CustomerType.BUSINESS, name: "TelecomCell Infra Towers Corp", contact: "Bhavin Patel", email: "telecom-power@telecomcell.in", phone: "+91 98250 44557", address: "Sarkhej-Bavla Highway, Changodar", city: "Ahmedabad", state: "Gujarat", country: "India", postalCode: "382213", gst: "24AABCT6789W1Z4" },
    { code: "CUS-000108", type: CustomerType.BUSINESS, name: "Kisan Agrotech Solar Pumps", contact: "Mahesh Chouhan", email: "pumps@kisanagrotech.org", phone: "+91 98260 77888", address: "Sector F, Sanwer Road Industrial Area", city: "Indore", state: "Madhya Pradesh", country: "India", postalCode: "452015", gst: "23AABCK0123M1Z6" },
    { code: "CUS-000109", type: CustomerType.INDIVIDUAL, name: "Rajesh Kumar (EV DIY Enthusiast)", contact: "Rajesh Kumar", email: "rajesh.evbuilder@gmail.com", phone: "+91 98190 22349", address: "Apt 402, Sea Breeze Heights, Bandra West", city: "Mumbai", state: "Maharashtra", country: "India", postalCode: "400050", gst: null },
    { code: "CUS-000110", type: CustomerType.BUSINESS, name: "Vikramaditya Power & Energy Labs", contact: "Debabrata Sen", email: "director@vikramadityapower.co.in", phone: "+91 98300 66770", address: "Salt Lake Sector V, Electronics Complex", city: "Kolkata", state: "West Bengal", country: "India", postalCode: "700091", gst: "19AABCV4567N1Z8" }
  ];

  const customerMap: Record<string, string> = {};
  for (const c of customersData) {
    const cust = await prisma.customer.upsert({
      where: { customerCode: c.code },
      update: {
        name: c.name,
        contactPerson: c.contact,
        email: c.email,
        phone: c.phone,
        billingAddress: c.address,
        shippingAddress: c.address,
        city: c.city,
        state: c.state,
        country: c.country,
        postalCode: c.postalCode,
        taxGst: c.gst,
        status: CustomerStatus.ACTIVE,
        assignedUserId: userMap[Role.SALES_EXECUTIVE]
      },
      create: {
        customerCode: c.code,
        type: c.type,
        name: c.name,
        contactPerson: c.contact,
        email: c.email,
        phone: c.phone,
        billingAddress: c.address,
        shippingAddress: c.address,
        city: c.city,
        state: c.state,
        country: c.country,
        postalCode: c.postalCode,
        taxGst: c.gst,
        status: CustomerStatus.ACTIVE,
        assignedUserId: userMap[Role.SALES_EXECUTIVE]
      }
    });
    customerMap[c.code] = cust.id;
  }

  const leadsData = [
    { num: "LEAD-000101", name: "Anand Verma", comp: "ElectroRide Mobility", email: "procurement@electroride.in", phone: "+91 98200 11221", status: LeadStatus.CONVERTED, priority: LeadPriority.URGENT, src: "Auto Expo 2026", summary: "Requirement for 250 units 24V 50Ah LFP packs for delivery trikes", custCode: "CUS-000101" },
    { num: "LEAD-000102", name: "Sunil Deshmukh", comp: "SuryaShakti Solar", email: "orders@suryashakti-solar.com", phone: "+91 98220 33442", status: LeadStatus.CONVERTED, priority: LeadPriority.HIGH, src: "Website Inquiry", summary: "50 units 48V 100Ah ESS battery modules for solar offgrid projects", custCode: "CUS-000102" },
    { num: "LEAD-000103", name: "Vikram Malhotra", comp: "ZeptoFleet Fast Deliveries", email: "vikram@zeptofleet.in", phone: "+91 98112 33445", status: LeadStatus.PROPOSAL, priority: LeadPriority.HIGH, src: "Referral", summary: "100 units 72V 45Ah swappable battery packs for delivery riders", custCode: null },
    { num: "LEAD-000104", name: "Pooja Hegde", comp: "SkyWing Agro-Drones", email: "pooja@skywingdrones.com", phone: "+91 98450 88991", status: LeadStatus.QUALIFIED, priority: LeadPriority.MEDIUM, src: "Inbound RFP", summary: "Ultra high-discharge 6S/12S drone batteries with IP67 encasing", custCode: null },
    { num: "LEAD-000105", name: "Arvind Swamy", comp: "Kochi Electric Ferry Works", email: "arvind@kochiferry.org", phone: "+91 98471 22334", status: LeadStatus.CONTACTED, priority: LeadPriority.HIGH, src: "Government Tender", summary: "High voltage 96V 200Ah marine propulsion lithium battery bank", custCode: null },
    { num: "LEAD-000106", name: "Manoj Tiwari", comp: "Ganga E-Rickshaw Union", email: "manoj@gangarickshaw.in", phone: "+91 98180 44556", status: LeadStatus.NEW, priority: LeadPriority.MEDIUM, src: "Trade Expo", summary: "Affordable 48V 30Ah LFP battery packs for local e-rickshaw drivers", custCode: null },
    { num: "LEAD-000107", name: "Bhavin Patel", comp: "TelecomCell Infra", email: "telecom-power@telecomcell.in", phone: "+91 98250 44557", status: LeadStatus.CONVERTED, priority: LeadPriority.HIGH, src: "Direct Inbound", summary: "40 units 48V 50Ah rack mount batteries for cell towers", custCode: "CUS-000107" },
    { num: "LEAD-000108", name: "Rajesh Kumar", comp: "Custom EV Garage", email: "rajesh.evbuilder@gmail.com", phone: "+91 98190 22349", status: LeadStatus.CONVERTED, priority: LeadPriority.LOW, src: "YouTube Channel", summary: "Custom 60V 30Ah NMC pack for vintage scooter restoration", custCode: "CUS-000109" },
    { num: "LEAD-000109", name: "Siddharth Roy", comp: "Bengal Electric Cabs", email: "siddharth@bengalcabs.in", phone: "+91 98310 99887", status: LeadStatus.QUALIFIED, priority: LeadPriority.MEDIUM, src: "Cold Outreach", summary: "Fleet trial for 20 units 72V 45Ah swappable battery packs", custCode: null },
    { num: "LEAD-000110", name: "Tarun Chawla", comp: "Punjab Solar Pumps", email: "tarun@punjabsolaar.com", phone: "+91 98760 33441", status: LeadStatus.LOST, priority: LeadPriority.LOW, src: "Website Inquiry", summary: "Looking for low-cost lead acid alternatives; pricing exceeded budget", custCode: null }
  ];

  const leadMap: Record<string, string> = {};
  for (const l of leadsData) {
    const custId = l.custCode ? customerMap[l.custCode] : null;
    const lead = await prisma.lead.upsert({
      where: { leadNumber: l.num },
      update: {
        name: l.name,
        companyName: l.comp,
        email: l.email,
        phone: l.phone,
        source: l.src,
        status: l.status,
        priority: l.priority,
        assignedUserId: userMap[Role.SALES_EXECUTIVE],
        requirementSummary: l.summary,
        convertedCustomerId: custId,
        convertedAt: custId ? new Date() : null,
        convertedByUserId: custId ? userMap[Role.SALES_EXECUTIVE] : null
      },
      create: {
        leadNumber: l.num,
        name: l.name,
        companyName: l.comp,
        email: l.email,
        phone: l.phone,
        source: l.src,
        status: l.status,
        priority: l.priority,
        assignedUserId: userMap[Role.SALES_EXECUTIVE],
        requirementSummary: l.summary,
        convertedCustomerId: custId,
        convertedAt: custId ? new Date() : null,
        convertedByUserId: custId ? userMap[Role.SALES_EXECUTIVE] : null
      }
    });
    leadMap[l.num] = lead.id;
  }

  // 10 CRM Activities
  const activitiesData = [
    { type: ActivityType.CALL, subj: "Initial Specs Review - ElectroRide Delivery Trike", leadNum: "LEAD-000101", status: ActivityStatus.COMPLETED },
    { type: ActivityType.MEETING, subj: "Technical Presentation on 48V 100Ah ESS Cycle Life", leadNum: "LEAD-000102", status: ActivityStatus.COMPLETED },
    { type: ActivityType.FOLLOW_UP, subj: "Quotation Follow-up: 72V 45Ah Swappable Pack", leadNum: "LEAD-000103", status: ActivityStatus.PENDING },
    { type: ActivityType.MEETING, subj: "Drone Battery Enclosure & Weight Budget Discussion", leadNum: "LEAD-000104", status: ActivityStatus.COMPLETED },
    { type: ActivityType.CALL, subj: "Marine Saltwater Corrosion & IP68 Certification Query", leadNum: "LEAD-000105", status: ActivityStatus.PENDING },
    { type: ActivityType.CALL, subj: "E-Rickshaw Union Financing Options Briefing", leadNum: "LEAD-000106", status: ActivityStatus.PENDING },
    { type: ActivityType.EMAIL, subj: "Sent Telecom Rack Dimension Drawings & Specs", leadNum: "LEAD-000107", status: ActivityStatus.COMPLETED },
    { type: ActivityType.TASK, subj: "Prepare Custom Wiring Harness for DIY Project", leadNum: "LEAD-000108", status: ActivityStatus.COMPLETED },
    { type: ActivityType.MEETING, subj: "Fleet Swap Station Trial Pitch in Kolkata", leadNum: "LEAD-000109", status: ActivityStatus.PENDING },
    { type: ActivityType.NOTE, subj: "Customer opted for competitor lead-acid pricing", leadNum: "LEAD-000110", status: ActivityStatus.COMPLETED }
  ];

  for (const act of activitiesData) {
    const lId = leadMap[act.leadNum];
    const existing = await prisma.activity.findFirst({
      where: { subject: act.subj, leadId: lId }
    });
    if (!existing) {
      await prisma.activity.create({
        data: {
          activityType: act.type,
          subject: act.subj,
          description: `Detailed CRM activity log for ${act.subj}`,
          leadId: lId,
          assignedUserId: userMap[Role.SALES_EXECUTIVE],
          createdByUserId: userMap[Role.SALES_EXECUTIVE],
          status: act.status,
          dueDate: new Date(Date.now() + 86400000 * 3),
          completionDate: act.status === ActivityStatus.COMPLETED ? new Date() : null
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Quotations (10) & Sales Orders (10)
  // ---------------------------------------------------------------------------
  console.log("\n📑 [6/12] Seeding 10 Quotations & 10 Sales Orders with Line Items & Financial Clearances...");

  const quotationsData = [
    { num: "QT-000101", custCode: "CUS-000101", leadNum: "LEAD-000101", status: QuotationStatus.ACCEPTED, sub: 1250000, tax: 225000, grand: 1475000, items: [{ sku: "CELL-18650-50AH", desc: "24V 50Ah LFP Battery Pack (Commercial Grade)", qty: 50, price: 25000 }] },
    { num: "QT-000102", custCode: "CUS-000102", leadNum: "LEAD-000102", status: QuotationStatus.ACCEPTED, sub: 1900000, tax: 342000, grand: 2242000, items: [{ sku: "CELL-32140-100AH", desc: "48V 100Ah Solar Energy Storage Unit", qty: 20, price: 95000 }] },
    { num: "QT-000103", custCode: "CUS-000103", leadNum: null, status: QuotationStatus.APPROVED, sub: 840000, tax: 151200, grand: 991200, items: [{ sku: "CELL-18650-50AH", desc: "24V 50Ah Commercial E-Rickshaw Battery Pack", qty: 35, price: 24000 }] },
    { num: "QT-000104", custCode: "CUS-000104", leadNum: null, status: QuotationStatus.SENT, sub: 480000, tax: 86400, grand: 566400, items: [{ sku: "CELL-21700-60AH", desc: "Custom 6S High Discharge Drone Battery Modules", qty: 15, price: 32000 }] },
    { num: "QT-000105", custCode: "CUS-000105", leadNum: null, status: QuotationStatus.ACCEPTED, sub: 1620000, tax: 291600, grand: 1911600, items: [{ sku: "CELL-18650-50AH", desc: "72V 45Ah Delivery Fleet High-Duty Battery Packs", qty: 36, price: 45000 }] },
    { num: "QT-000106", custCode: "CUS-000106", leadNum: null, status: QuotationStatus.PENDING_APPROVAL, sub: 620000, tax: 111600, grand: 731600, items: [{ sku: "CELL-32140-100AH", desc: "12V 100Ah Marine Deep Cycle Battery Units", qty: 20, price: 31000 }] },
    { num: "QT-000107", custCode: "CUS-000107", leadNum: "LEAD-000107", status: QuotationStatus.ACCEPTED, sub: 1400000, tax: 252000, grand: 1652000, items: [{ sku: "CELL-18650-50AH", desc: "48V 50Ah Telecom Tower Rack-Mount Battery", qty: 28, price: 50000 }] },
    { num: "QT-000108", custCode: "CUS-000108", leadNum: null, status: QuotationStatus.SENT, sub: 780000, tax: 140400, grand: 920400, items: [{ sku: "CELL-32140-100AH", desc: "48V 100Ah Solar Agricultural Pump Storage Pack", qty: 8, price: 97500 }] },
    { num: "QT-000109", custCode: "CUS-000109", leadNum: "LEAD-000108", status: QuotationStatus.ACCEPTED, sub: 38000, tax: 6840, grand: 44840, items: [{ sku: "CELL-21700-60AH", desc: "60V 30Ah EV Scooter Custom Retrofit Pack", qty: 1, price: 38000 }] },
    { num: "QT-000110", custCode: "CUS-000110", leadNum: null, status: QuotationStatus.CUSTOMER_VIEWED, sub: 1150000, tax: 207000, grand: 1357000, items: [{ sku: "CELL-32140-100AH", desc: "48V 100Ah Industrial Grade Battery Pack", qty: 12, price: 95833 }] }
  ];

  const quotationMap: Record<string, string> = {};

  for (const q of quotationsData) {
    const cust = customersData.find(c => c.code === q.custCode)!;
    const custId = customerMap[q.custCode];
    const lId = q.leadNum ? leadMap[q.leadNum] : null;

    const createdQ = await prisma.quotation.upsert({
      where: { quotationNumber: q.num },
      update: {
        customerId: custId,
        leadId: lId,
        createdById: userMap[Role.SALES_EXECUTIVE],
        assignedSalesUserId: userMap[Role.SALES_EXECUTIVE],
        quotationDate: new Date(Date.now() - 86400000 * 10),
        validUntil: new Date(Date.now() + 86400000 * 20),
        status: q.status,
        subtotal: q.sub,
        discount: 0,
        tax: q.tax,
        grandTotal: q.grand,
        paymentTerms: "50% Advance, 50% Before Dispatch",
        deliveryTerms: "EXW Pune Works",
        customerNameSnapshot: cust.name,
        customerEmailSnapshot: cust.email,
        customerPhoneSnapshot: cust.phone,
        billingAddressSnapshot: cust.address,
        shippingAddressSnapshot: cust.address,
        citySnapshot: cust.city,
        stateSnapshot: cust.state,
        countrySnapshot: cust.country,
        postalCodeSnapshot: cust.postalCode
      },
      create: {
        quotationNumber: q.num,
        customerId: custId,
        leadId: lId,
        createdById: userMap[Role.SALES_EXECUTIVE],
        assignedSalesUserId: userMap[Role.SALES_EXECUTIVE],
        quotationDate: new Date(Date.now() - 86400000 * 10),
        validUntil: new Date(Date.now() + 86400000 * 20),
        status: q.status,
        subtotal: q.sub,
        discount: 0,
        tax: q.tax,
        grandTotal: q.grand,
        paymentTerms: "50% Advance, 50% Before Dispatch",
        deliveryTerms: "EXW Pune Works",
        customerNameSnapshot: cust.name,
        customerEmailSnapshot: cust.email,
        customerPhoneSnapshot: cust.phone,
        billingAddressSnapshot: cust.address,
        shippingAddressSnapshot: cust.address,
        citySnapshot: cust.city,
        stateSnapshot: cust.state,
        countrySnapshot: cust.country,
        postalCodeSnapshot: cust.postalCode
      }
    });
    quotationMap[q.num] = createdQ.id;

    for (const itm of q.items) {
      const matId = materialMap[itm.sku];
      const existingItm = await prisma.quotationItem.findFirst({
        where: { quotationId: createdQ.id, description: itm.desc }
      });
      if (!existingItm) {
        await prisma.quotationItem.create({
          data: {
            quotationId: createdQ.id,
            materialId: matId,
            description: itm.desc,
            quantity: itm.qty,
            unitPrice: itm.price,
            discount: 0,
            taxRate: 18.0,
            taxAmount: (itm.qty * itm.price * 0.18),
            lineSubtotal: itm.qty * itm.price,
            lineTotal: itm.qty * itm.price * 1.18,
            specification: "Tested Grade A Cells, Smart Active Balancing BMS"
          }
        });
      }
    }
  }

  // 10 Sales Orders
  const salesOrdersData = [
    { num: "SO-000101", qNum: "QT-000101", custCode: "CUS-000101", status: SalesOrderStatus.FULFILLED, pStatus: SalesOrderPaymentStatus.PAID, sub: 1250000, tax: 225000, grand: 1475000, cleared: true, desc: "24V 50Ah LFP Battery Pack", qty: 50, fulQty: 50 },
    { num: "SO-000102", qNum: "QT-000102", custCode: "CUS-000102", status: SalesOrderStatus.IN_FULFILLMENT, pStatus: SalesOrderPaymentStatus.PARTIALLY_PAID, sub: 1900000, tax: 342000, grand: 2242000, cleared: true, desc: "48V 100Ah Solar Energy Storage Unit", qty: 20, fulQty: 10 },
    { num: "SO-000103", qNum: "QT-000103", custCode: "CUS-000103", status: SalesOrderStatus.READY_FOR_FULFILLMENT, pStatus: SalesOrderPaymentStatus.PARTIALLY_PAID, sub: 840000, tax: 151200, grand: 991200, cleared: true, desc: "24V 50Ah Commercial E-Rickshaw Battery Pack", qty: 35, fulQty: 0 },
    { num: "SO-000104", qNum: "QT-000104", custCode: "CUS-000104", status: SalesOrderStatus.CONFIRMED, pStatus: SalesOrderPaymentStatus.PENDING, sub: 480000, tax: 86400, grand: 566400, cleared: false, desc: "Custom 6S High Discharge Drone Battery Modules", qty: 15, fulQty: 0 },
    { num: "SO-000105", qNum: "QT-000105", custCode: "CUS-000105", status: SalesOrderStatus.IN_FULFILLMENT, pStatus: SalesOrderPaymentStatus.PAID, sub: 1620000, tax: 291600, grand: 1911600, cleared: true, desc: "72V 45Ah Delivery Fleet High-Duty Battery Packs", qty: 36, fulQty: 18 },
    { num: "SO-000106", qNum: "QT-000106", custCode: "CUS-000106", status: SalesOrderStatus.CONFIRMED, pStatus: SalesOrderPaymentStatus.PENDING, sub: 620000, tax: 111600, grand: 731600, cleared: false, desc: "12V 100Ah Marine Deep Cycle Battery Units", qty: 20, fulQty: 0 },
    { num: "SO-000107", qNum: "QT-000107", custCode: "CUS-000107", status: SalesOrderStatus.FULFILLED, pStatus: SalesOrderPaymentStatus.PAID, sub: 1400000, tax: 252000, grand: 1652000, cleared: true, desc: "48V 50Ah Telecom Tower Rack-Mount Battery", qty: 28, fulQty: 28 },
    { num: "SO-000108", qNum: "QT-000108", custCode: "CUS-000108", status: SalesOrderStatus.CONFIRMED, pStatus: SalesOrderPaymentStatus.PENDING, sub: 780000, tax: 140400, grand: 920400, cleared: false, desc: "48V 100Ah Solar Agricultural Pump Storage Pack", qty: 8, fulQty: 0 },
    { num: "SO-000109", qNum: "QT-000109", custCode: "CUS-000109", status: SalesOrderStatus.FULFILLED, pStatus: SalesOrderPaymentStatus.PAID, sub: 38000, tax: 6840, grand: 44840, cleared: true, desc: "60V 30Ah EV Scooter Custom Retrofit Pack", qty: 1, fulQty: 1 },
    { num: "SO-000110", qNum: "QT-000110", custCode: "CUS-000110", status: SalesOrderStatus.CONFIRMED, pStatus: SalesOrderPaymentStatus.PENDING, sub: 1150000, tax: 207000, grand: 1357000, cleared: false, desc: "48V 100Ah Industrial Grade Battery Pack", qty: 12, fulQty: 0 }
  ];

  const salesOrderMap: Record<string, string> = {};
  const soItemMap: Record<string, string> = {};

  for (const so of salesOrdersData) {
    const cust = customersData.find(c => c.code === so.custCode)!;
    const custId = customerMap[so.custCode];
    const qId = quotationMap[so.qNum];

    const createdSO = await prisma.salesOrder.upsert({
      where: { salesOrderNumber: so.num },
      update: {
        customerId: custId,
        quotationId: qId,
        createdById: userMap[Role.SALES_EXECUTIVE],
        assignedSalesUserId: userMap[Role.SALES_EXECUTIVE],
        orderDate: new Date(Date.now() - 86400000 * 8),
        requiredDeliveryDate: new Date(Date.now() + 86400000 * 15),
        status: so.status,
        paymentStatus: so.pStatus,
        subtotal: so.sub,
        discount: 0,
        tax: so.tax,
        grandTotal: so.grand,
        paymentTerms: "50% Advance, 50% Before Dispatch",
        deliveryTerms: "EXW Pune Works",
        billingAddressSnapshot: cust.address,
        shippingAddressSnapshot: cust.address,
        isFinancialCleared: so.cleared,
        financialClearedAt: so.cleared ? new Date(Date.now() - 86400000 * 7) : null,
        financialClearedById: so.cleared ? userMap[Role.ACCOUNTANT] : null,
        financialOriginalAmount: so.grand
      },
      create: {
        salesOrderNumber: so.num,
        customerId: custId,
        quotationId: qId,
        createdById: userMap[Role.SALES_EXECUTIVE],
        assignedSalesUserId: userMap[Role.SALES_EXECUTIVE],
        orderDate: new Date(Date.now() - 86400000 * 8),
        requiredDeliveryDate: new Date(Date.now() + 86400000 * 15),
        status: so.status,
        paymentStatus: so.pStatus,
        subtotal: so.sub,
        discount: 0,
        tax: so.tax,
        grandTotal: so.grand,
        paymentTerms: "50% Advance, 50% Before Dispatch",
        deliveryTerms: "EXW Pune Works",
        billingAddressSnapshot: cust.address,
        shippingAddressSnapshot: cust.address,
        isFinancialCleared: so.cleared,
        financialClearedAt: so.cleared ? new Date(Date.now() - 86400000 * 7) : null,
        financialClearedById: so.cleared ? userMap[Role.ACCOUNTANT] : null,
        financialOriginalAmount: so.grand
      }
    });
    salesOrderMap[so.num] = createdSO.id;

    const existingSOItem = await prisma.salesOrderItem.findFirst({
      where: { salesOrderId: createdSO.id }
    });

    if (!existingSOItem) {
      const soItm = await prisma.salesOrderItem.create({
        data: {
          salesOrderId: createdSO.id,
          description: so.desc,
          quantityOrdered: so.qty,
          quantityFulfilled: so.fulQty,
          quantityPending: so.qty - so.fulQty,
          quantityCancelled: 0,
          unitPrice: (so.sub / so.qty),
          discount: 0,
          taxRate: 18.0,
          taxAmount: (so.tax),
          lineSubtotal: so.sub,
          lineTotal: so.grand,
          fulfillmentType: FulfillmentType.PRODUCTION_REQUIRED
        }
      });
      soItemMap[so.num] = soItm.id;
    } else {
      soItemMap[so.num] = existingSOItem.id;
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Procurement: 10 Purchase Requests, 10 Purchase Orders & 10 GRNs
  // ---------------------------------------------------------------------------
  console.log("\n🚚 [7/12] Seeding 10 Purchase Requests, 10 Purchase Orders & 10 GRNs...");

  const prsData = [
    { num: "PR-000101", src: PurchaseRequestSource.SALES_ORDER, status: PurchaseRequestStatus.COMPLETED, prio: PurchaseRequestPriority.URGENT, reason: "Bulk cell batch replenishment for ElectroRide 50-pack order", sku: "CELL-18650-50AH", qty: 500 },
    { num: "PR-000102", src: PurchaseRequestSource.PRODUCTION_REQUIREMENT, status: PurchaseRequestStatus.COMPLETED, prio: PurchaseRequestPriority.HIGH, reason: "16S BMS inventory restock for SuryaShakti ESS production", sku: "BMS-16S-100A", qty: 30 },
    { num: "PR-000103", src: PurchaseRequestSource.LOW_STOCK, status: PurchaseRequestStatus.ORDERED, prio: PurchaseRequestPriority.NORMAL, reason: "Copper busbar stock level fell below reorder threshold", sku: "BUS-CU-20MM", qty: 250 },
    { num: "PR-000104", src: PurchaseRequestSource.SALES_ORDER, status: PurchaseRequestStatus.APPROVED, prio: PurchaseRequestPriority.HIGH, reason: "Heavy gauge silicone power cables for 72V fleet battery packs", sku: "WIRE-6AWG-RED", qty: 150 },
    { num: "PR-000105", src: PurchaseRequestSource.SERVICE, status: PurchaseRequestStatus.COMPLETED, prio: PurchaseRequestPriority.URGENT, reason: "Replacement 4S BMS boards for service department customer repairs", sku: "BMS-4S-40A", qty: 25 },
    { num: "PR-000106", src: PurchaseRequestSource.MANUAL, status: PurchaseRequestStatus.ORDERED, prio: PurchaseRequestPriority.NORMAL, reason: "Corrosion-proof nickel busbars for marine battery production", sku: "BUS-NI-30MM", qty: 100 },
    { num: "PR-000107", src: PurchaseRequestSource.LOW_STOCK, status: PurchaseRequestStatus.APPROVED, prio: PurchaseRequestPriority.HIGH, reason: "ANL high-current fuses safety buffer stock replenishment", sku: "FUSE-100A-ANL", qty: 50 },
    { num: "PR-000108", src: PurchaseRequestSource.SALES_ORDER, status: PurchaseRequestStatus.COMPLETED, prio: PurchaseRequestPriority.NORMAL, reason: "Heavy aluminum battery pack enclosures for telecom racks", sku: "ENC-AL-LG", qty: 30 },
    { num: "PR-000109", src: PurchaseRequestSource.MANUAL, status: PurchaseRequestStatus.PENDING_APPROVAL, prio: PurchaseRequestPriority.LOW, reason: "High conductivity thermal pads roll replenishment", sku: "THERM-PAD-2MM", qty: 50 },
    { num: "PR-000110", src: PurchaseRequestSource.LOW_STOCK, status: PurchaseRequestStatus.DRAFT, prio: PurchaseRequestPriority.NORMAL, reason: "Production QR and safety hazard adhesive labels", sku: "LBL-BATT-WARN", qty: 500 }
  ];

  const prMap: Record<string, string> = {};
  for (const pr of prsData) {
    const matId = materialMap[pr.sku];
    const createdPR = await prisma.purchaseRequest.upsert({
      where: { prNumber: pr.num },
      update: {
        requestedById: userMap[Role.PURCHASE_MANAGER],
        source: pr.src,
        priority: pr.prio,
        requiredDate: new Date(Date.now() + 86400000 * 7),
        status: pr.status,
        reason: pr.reason
      },
      create: {
        prNumber: pr.num,
        requestedById: userMap[Role.PURCHASE_MANAGER],
        source: pr.src,
        priority: pr.prio,
        requiredDate: new Date(Date.now() + 86400000 * 7),
        status: pr.status,
        reason: pr.reason
      }
    });
    prMap[pr.num] = createdPR.id;

    if (matId) {
      const existingPRItem = await prisma.purchaseRequestItem.findFirst({
        where: { purchaseRequestId: createdPR.id }
      });
      if (!existingPRItem) {
        await prisma.purchaseRequestItem.create({
          data: {
            purchaseRequestId: createdPR.id,
            materialId: matId,
            requestedQuantity: pr.qty,
            requiredDate: new Date(Date.now() + 86400000 * 7),
            specification: "OEM Grade with Inspection Certificate"
          }
        });
      }
    }
  }

  // 10 Purchase Orders
  const posData = [
    { num: "PO-000101", prNum: "PR-000101", vName: "Apex Lithium Tech India Pvt Ltd", status: PurchaseOrderStatus.RECEIVED, sub: 225000, tax: 40500, grand: 265500, sku: "CELL-18650-50AH", qty: 500, unitP: 450 },
    { num: "PO-000102", prNum: "PR-000102", vName: "Quantum Smart BMS Systems Pvt Ltd", status: PurchaseOrderStatus.RECEIVED, sub: 37500, tax: 6750, grand: 44250, sku: "BMS-16S-100A", qty: 30, unitP: 1250 },
    { num: "PO-000103", prNum: "PR-000103", vName: "NexGen Copper Conductors & Busbars", status: PurchaseOrderStatus.PARTIALLY_RECEIVED, sub: 21250, tax: 3825, grand: 25075, sku: "BUS-CU-20MM", qty: 250, unitP: 85 },
    { num: "PO-000104", prNum: "PR-000104", vName: "SunPower Electronics Components", status: PurchaseOrderStatus.APPROVED, sub: 27000, tax: 4860, grand: 31860, sku: "WIRE-6AWG-RED", qty: 150, unitP: 180 },
    { num: "PO-000105", prNum: "PR-000105", vName: "Quantum Smart BMS Systems Pvt Ltd", status: PurchaseOrderStatus.RECEIVED, sub: 9500, tax: 1710, grand: 11210, sku: "BMS-4S-40A", qty: 25, unitP: 380 },
    { num: "PO-000106", prNum: "PR-000106", vName: "NexGen Copper Conductors & Busbars", status: PurchaseOrderStatus.APPROVED, sub: 14500, tax: 2610, grand: 17110, sku: "BUS-NI-30MM", qty: 100, unitP: 145 },
    { num: "PO-000107", prNum: "PR-000107", vName: "SunPower Electronics Components", status: PurchaseOrderStatus.APPROVED, sub: 4750, tax: 855, grand: 5605, sku: "FUSE-100A-ANL", qty: 50, unitP: 95 },
    { num: "PO-000108", prNum: "PR-000108", vName: "Delta Enclosures & Heavy Moulding", status: PurchaseOrderStatus.RECEIVED, sub: 55500, tax: 9990, grand: 65490, sku: "ENC-AL-LG", qty: 30, unitP: 1850 },
    { num: "PO-000109", prNum: null, vName: "Thermal Shield Polymers & Insulations", status: PurchaseOrderStatus.SENT, sub: 6000, tax: 1080, grand: 7080, sku: "THERM-PAD-2MM", qty: 50, unitP: 120 },
    { num: "PO-000110", prNum: null, vName: "Precision Fasteners & Hardware Ltd", status: PurchaseOrderStatus.DRAFT, sub: 1500, tax: 270, grand: 1770, sku: "FAST-M4-BOLT", qty: 500, unitP: 3 }
  ];

  const poMap: Record<string, string> = {};
  for (const po of posData) {
    const vId = vendorMap[po.vName];
    const prId = po.prNum ? prMap[po.prNum] : null;
    const matId = materialMap[po.sku];

    const createdPO = await prisma.purchaseOrder.upsert({
      where: { poNumber: po.num },
      update: {
        vendorId: vId,
        purchaseRequestId: prId,
        createdById: userMap[Role.PURCHASE_MANAGER],
        orderDate: new Date(Date.now() - 86400000 * 6),
        expectedDeliveryDate: new Date(Date.now() + 86400000 * 5),
        status: po.status,
        subtotal: po.sub,
        discount: 0,
        tax: po.tax,
        grandTotal: po.grand,
        paymentTerms: "30 Days Net Credit",
        deliveryTerms: "Door Delivery to Chakan MIDC",
        billingAddress: "KYRA ZAM Factory, Plot 14, Phase 2, Chakan MIDC, Pune 410501",
        deliveryAddress: "KYRA ZAM Central Store, Gate 1, Chakan MIDC, Pune 410501"
      },
      create: {
        poNumber: po.num,
        vendorId: vId,
        purchaseRequestId: prId,
        createdById: userMap[Role.PURCHASE_MANAGER],
        orderDate: new Date(Date.now() - 86400000 * 6),
        expectedDeliveryDate: new Date(Date.now() + 86400000 * 5),
        status: po.status,
        subtotal: po.sub,
        discount: 0,
        tax: po.tax,
        grandTotal: po.grand,
        paymentTerms: "30 Days Net Credit",
        deliveryTerms: "Door Delivery to Chakan MIDC",
        billingAddress: "KYRA ZAM Factory, Plot 14, Phase 2, Chakan MIDC, Pune 410501",
        deliveryAddress: "KYRA ZAM Central Store, Gate 1, Chakan MIDC, Pune 410501"
      }
    });
    poMap[po.num] = createdPO.id;

    if (matId) {
      const existingPOItem = await prisma.purchaseOrderItem.findFirst({
        where: { purchaseOrderId: createdPO.id }
      });
      if (!existingPOItem) {
        await prisma.purchaseOrderItem.create({
          data: {
            purchaseOrderId: createdPO.id,
            materialId: matId,
            description: `Procurement line for ${po.sku}`,
            quantityOrdered: po.qty,
            quantityReceived: (po.status === PurchaseOrderStatus.RECEIVED ? po.qty : (po.status === PurchaseOrderStatus.PARTIALLY_RECEIVED ? Math.floor(po.qty / 2) : 0)),
            quantityPending: (po.status === PurchaseOrderStatus.RECEIVED ? 0 : po.qty),
            quantityCancelled: 0,
            unitPrice: po.unitP,
            discount: 0,
            taxRate: 18.0,
            taxAmount: po.tax,
            lineSubtotal: po.sub,
            lineTotal: po.grand
          }
        });
      }
    }
  }

  // 10 Goods Receipts (GRNs)
  const grnsData = [
    { num: "GRN-000101", poNum: "PO-000101", status: GoodsReceiptStatus.STOCKED, vName: "Apex Lithium Tech India Pvt Ltd", sku: "CELL-18650-50AH", qty: 500, acc: 498, rej: 2 },
    { num: "GRN-000102", poNum: "PO-000102", status: GoodsReceiptStatus.STOCKED, vName: "Quantum Smart BMS Systems Pvt Ltd", sku: "BMS-16S-100A", qty: 30, acc: 30, rej: 0 },
    { num: "GRN-000103", poNum: "PO-000103", status: GoodsReceiptStatus.PARTIALLY_ACCEPTED, vName: "NexGen Copper Conductors & Busbars", sku: "BUS-CU-20MM", qty: 150, acc: 145, rej: 5 },
    { num: "GRN-000104", poNum: "PO-000105", status: GoodsReceiptStatus.STOCKED, vName: "Quantum Smart BMS Systems Pvt Ltd", sku: "BMS-4S-40A", qty: 25, acc: 25, rej: 0 },
    { num: "GRN-000105", poNum: "PO-000108", status: GoodsReceiptStatus.STOCKED, vName: "Delta Enclosures & Heavy Moulding", sku: "ENC-AL-LG", qty: 30, acc: 30, rej: 0 },
    { num: "GRN-000106", poNum: "PO-000104", status: GoodsReceiptStatus.QC_PENDING, vName: "SunPower Electronics Components", sku: "WIRE-6AWG-RED", qty: 150, acc: 0, rej: 0 },
    { num: "GRN-000107", poNum: "PO-000106", status: GoodsReceiptStatus.QC_PENDING, vName: "NexGen Copper Conductors & Busbars", sku: "BUS-NI-30MM", qty: 100, acc: 0, rej: 0 },
    { num: "GRN-000108", poNum: "PO-000107", status: GoodsReceiptStatus.RECEIVING, vName: "SunPower Electronics Components", sku: "FUSE-100A-ANL", qty: 50, acc: 0, rej: 0 },
    { num: "GRN-000109", poNum: "PO-000109", status: GoodsReceiptStatus.EXPECTED, vName: "Thermal Shield Polymers & Insulations", sku: "THERM-PAD-2MM", qty: 50, acc: 0, rej: 0 },
    { num: "GRN-000110", poNum: "PO-000110", status: GoodsReceiptStatus.EXPECTED, vName: "Precision Fasteners & Hardware Ltd", sku: "FAST-M4-BOLT", qty: 500, acc: 0, rej: 0 }
  ];

  for (const grn of grnsData) {
    const poId = poMap[grn.poNum];
    const vId = vendorMap[grn.vName];
    const matId = materialMap[grn.sku];

    const createdGRN = await prisma.goodsReceipt.upsert({
      where: { grnNumber: grn.num },
      update: {
        purchaseOrderId: poId,
        vendorId: vId,
        receivedById: userMap[Role.INVENTORY_MANAGER],
        warehouseId: warehouseMap["WH-RAW"],
        status: grn.status,
        notes: `Inward gate entry verified for ${grn.sku}`
      },
      create: {
        grnNumber: grn.num,
        purchaseOrderId: poId,
        vendorId: vId,
        receivedById: userMap[Role.INVENTORY_MANAGER],
        warehouseId: warehouseMap["WH-RAW"],
        status: grn.status,
        notes: `Inward gate entry verified for ${grn.sku}`
      }
    });

    if (matId) {
      const existingGRNItem = await prisma.goodsReceiptItem.findFirst({
        where: { goodsReceiptId: createdGRN.id }
      });
      if (!existingGRNItem) {
        await prisma.goodsReceiptItem.create({
          data: {
            goodsReceiptId: createdGRN.id,
            materialId: matId,
            quantityOrdered: grn.qty,
            quantityReceived: grn.qty,
            quantityAccepted: grn.acc,
            quantityRejected: grn.rej,
            quantityDamaged: 0,
            batchNumber: `BATCH-${grn.num}`,
            inspectionStatus: grn.status === GoodsReceiptStatus.STOCKED ? "PASSED" : (grn.status === GoodsReceiptStatus.PARTIALLY_ACCEPTED ? "FAILED" : "PENDING")
          }
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Cell Testing: 10 Batches, 120+ Cells & Batch Analytics
  // ---------------------------------------------------------------------------
  console.log("\n⚡ [8/12] Seeding 10 Cell Inward Batches, 120+ Tested Cells & Batch Analytics...");

  const cellBatchesData = [
    { num: "INW-000101", batch: "BATCH-LFP-2026-A1", part: "MAT-CELL-001", sku: "CELL-18650-50AH", qty: 100, av: 60, tst: 100, rej: 2, con: 38, cat: "BATTERY CELLS", volt: 3.2 },
    { num: "INW-000102", batch: "BATCH-LFP-2026-A2", part: "MAT-CELL-001", sku: "CELL-18650-50AH", qty: 100, av: 70, tst: 100, rej: 1, con: 29, cat: "BATTERY CELLS", volt: 3.2 },
    { num: "INW-000103", batch: "BATCH-NMC-2026-B1", part: "MAT-CELL-002", sku: "CELL-21700-60AH", qty: 80, av: 50, tst: 80, rej: 3, con: 27, cat: "BATTERY CELLS", volt: 3.7 },
    { num: "INW-000104", batch: "BATCH-LFP-2026-C1", part: "MAT-CELL-003", sku: "CELL-32140-100AH", qty: 60, av: 40, tst: 60, rej: 1, con: 19, cat: "BATTERY CELLS", volt: 3.2 },
    { num: "INW-000105", batch: "BATCH-LFP-2026-A3", part: "MAT-CELL-001", sku: "CELL-18650-50AH", qty: 100, av: 95, tst: 100, rej: 2, con: 3, cat: "BATTERY CELLS", volt: 3.2 },
    { num: "INW-000106", batch: "BATCH-NMC-2026-B2", part: "MAT-CELL-002", sku: "CELL-21700-60AH", qty: 70, av: 70, tst: 50, rej: 1, con: 0, cat: "BATTERY CELLS", volt: 3.7 },
    { num: "INW-000107", batch: "BATCH-LFP-2026-C2", part: "MAT-CELL-003", sku: "CELL-32140-100AH", qty: 50, av: 50, tst: 50, rej: 0, con: 0, cat: "BATTERY CELLS", volt: 3.2 },
    { num: "INW-000108", batch: "BATCH-LFP-2026-A4", part: "MAT-CELL-001", sku: "CELL-18650-50AH", qty: 80, av: 80, tst: 0, rej: 0, con: 0, cat: "BATTERY CELLS", volt: 3.2 },
    { num: "INW-000109", batch: "BATCH-NMC-2026-B3", part: "MAT-CELL-002", sku: "CELL-21700-60AH", qty: 60, av: 60, tst: 0, rej: 0, con: 0, cat: "BATTERY CELLS", volt: 3.7 },
    { num: "INW-000110", batch: "BATCH-LFP-2026-C3", part: "MAT-CELL-003", sku: "CELL-32140-100AH", qty: 50, av: 50, tst: 0, rej: 0, con: 0, cat: "BATTERY CELLS", volt: 3.2 }
  ];

  const batchMap: Record<string, string> = {};

  for (const b of cellBatchesData) {
    const matId = materialMap[b.sku];
    const createdBatch = await prisma.cellInwardBatch.upsert({
      where: { inwardNumber: b.num },
      update: {
        partNumber: b.part,
        materialId: matId,
        batchNumber: b.batch,
        quantity: b.qty,
        availableQty: b.av,
        testedQty: b.tst,
        rejectedQty: b.rej,
        consumedQty: b.con,
        category: b.cat,
        voltage: b.volt,
        receivedById: userMap[Role.INVENTORY_MANAGER],
        status: b.tst > 0 ? "TESTED" : "RECEIVED"
      },
      create: {
        inwardNumber: b.num,
        partNumber: b.part,
        materialId: matId,
        batchNumber: b.batch,
        quantity: b.qty,
        availableQty: b.av,
        testedQty: b.tst,
        rejectedQty: b.rej,
        consumedQty: b.con,
        category: b.cat,
        voltage: b.volt,
        receivedById: userMap[Role.INVENTORY_MANAGER],
        status: b.tst > 0 ? "TESTED" : "RECEIVED"
      }
    });
    batchMap[b.batch] = createdBatch.id;

    // Batch Analytics
    await prisma.batchAnalytics.upsert({
      where: { batchNumber: b.batch },
      update: {
        totalCells: b.qty,
        passedCount: b.tst - b.rej,
        failedCount: b.rej,
        retestCount: 2,
        stabilityScore: 98.4
      },
      create: {
        batchNumber: b.batch,
        totalCells: b.qty,
        passedCount: b.tst - b.rej,
        failedCount: b.rej,
        retestCount: 2,
        stabilityScore: 98.4
      }
    });
  }

  // Seed 120 Individual Tested Cells
  const cellSerials: string[] = [];
  for (let i = 1; i <= 120; i++) {
    const serial = `CEL-2026-${String(i).padStart(4, "0")}`;
    cellSerials.push(serial);
    const batchKey = i <= 40 ? "BATCH-LFP-2026-A1" : (i <= 80 ? "BATCH-LFP-2026-A2" : "BATCH-NMC-2026-B1");
    const isRejected = i === 12 || i === 54 || i === 99;
    const volt = isRejected ? 2.65 : (3.22 + (i % 8) * 0.015);
    const ah = isRejected ? 2.4 : (3.21 + (i % 6) * 0.02);
    const ir = isRejected ? 68.5 : (18.2 + (i % 10) * 0.8);

    await prisma.cell.upsert({
      where: { serialNumber: serial },
      update: {
        inwardBatchId: batchMap[batchKey],
        partNumber: i <= 80 ? "MAT-CELL-001" : "MAT-CELL-002",
        batchNumber: batchKey,
        voltage: volt,
        category: "BATTERY CELLS",
        cycles: 0,
        ahValue: ah,
        irValue: ir,
        grade: isRejected ? "FAIL" : (i % 4 === 0 ? "A+" : "A"),
        status: isRejected ? CellStatus.REJECTED : CellStatus.CELL_TESTED,
        machineId: "AUTO-SORT-MACHINE-01",
        machineOperator: "Sunita Patel (Test Engineer)",
        machineCalibrationDate: new Date(Date.now() - 86400000 * 15)
      },
      create: {
        serialNumber: serial,
        inwardBatchId: batchMap[batchKey],
        partNumber: i <= 80 ? "MAT-CELL-001" : "MAT-CELL-002",
        batchNumber: batchKey,
        voltage: volt,
        category: "BATTERY CELLS",
        cycles: 0,
        ahValue: ah,
        irValue: ir,
        grade: isRejected ? "FAIL" : (i % 4 === 0 ? "A+" : "A"),
        status: isRejected ? CellStatus.REJECTED : CellStatus.CELL_TESTED,
        machineId: "AUTO-SORT-MACHINE-01",
        machineOperator: "Sunita Patel (Test Engineer)",
        machineCalibrationDate: new Date(Date.now() - 86400000 * 15)
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 9. Production: 10 Requirements, 10 Plans & 10 Work Orders
  // ---------------------------------------------------------------------------
  console.log("\n⚙️ [9/12] Seeding 10 Production Requirements, 10 Plans, 10 Work Orders & Schedulings...");

  const reqsData = [
    { num: "PRD-000101", soNum: "SO-000101", custCode: "CUS-000101", qty: 50, prio: "URGENT", status: ProductionRequirementStatus.COMPLETED, bomName: "BOM-24V-50AH: 24V 50Ah E-Rickshaw Pack", paxName: "24V 50Ah LFP E-Rickshaw Battery Pack" },
    { num: "PRD-000102", soNum: "SO-000102", custCode: "CUS-000102", qty: 20, prio: "HIGH", status: ProductionRequirementStatus.IN_PRODUCTION, bomName: "BOM-48V-100AH: 48V 100Ah Solar Energy Storage", paxName: "48V 100Ah Solar ESS High-Capacity Pack" },
    { num: "PRD-000103", soNum: "SO-000103", custCode: "CUS-000103", qty: 35, prio: "NORMAL", status: ProductionRequirementStatus.READY, bomName: "BOM-24V-50AH: 24V 50Ah E-Rickshaw Pack", paxName: "24V 50Ah LFP E-Rickshaw Battery Pack" },
    { num: "PRD-000104", soNum: "SO-000104", custCode: "CUS-000104", qty: 15, prio: "HIGH", status: ProductionRequirementStatus.PLANNED, bomName: "BOM-60V-30AH: 60V 30Ah EV Scooter Pack", paxName: "60V 30Ah EV Scooter High-Rate NMC Pack" },
    { num: "PRD-000105", soNum: "SO-000105", custCode: "CUS-000105", qty: 36, prio: "URGENT", status: ProductionRequirementStatus.IN_PRODUCTION, bomName: "BOM-72V-45AH: 72V 45Ah Delivery Fleet Pack", paxName: "72V 45Ah Delivery Fleet Heavy Duty Pack" },
    { num: "PRD-000106", soNum: "SO-000106", custCode: "CUS-000106", qty: 20, prio: "NORMAL", status: ProductionRequirementStatus.PENDING, bomName: "BOM-12V-100AH: 12V 100Ah Marine Deep Cycle", paxName: "12V 100Ah Marine & Caravan Deep Cycle Pack" },
    { num: "PRD-000107", soNum: "SO-000107", custCode: "CUS-000107", qty: 28, prio: "HIGH", status: ProductionRequirementStatus.COMPLETED, bomName: "BOM-48V-50AH: 48V 50Ah Telecom Backup Pack", paxName: "48V 50Ah Telecom Tower Backup LFP Pack" },
    { num: "PRD-000108", soNum: "SO-000108", custCode: "CUS-000108", qty: 8, prio: "NORMAL", status: ProductionRequirementStatus.MATERIAL_CHECK, bomName: "BOM-48V-100AH: 48V 100Ah Solar Energy Storage", paxName: "48V 100Ah Solar ESS High-Capacity Pack" },
    { num: "PRD-000109", soNum: "SO-000109", custCode: "CUS-000109", qty: 1, prio: "LOW", status: ProductionRequirementStatus.COMPLETED, bomName: "BOM-60V-30AH: 60V 30Ah EV Scooter Pack", paxName: "60V 30Ah EV Scooter High-Rate NMC Pack" },
    { num: "PRD-000110", soNum: "SO-000110", custCode: "CUS-000110", qty: 12, prio: "NORMAL", status: ProductionRequirementStatus.PENDING, bomName: "BOM-48V-100AH: 48V 100Ah Solar Energy Storage", paxName: "48V 100Ah Solar ESS High-Capacity Pack" }
  ];

  const reqMap: Record<string, string> = {};
  const planMap: Record<string, string> = {};
  const woMap: Record<string, string> = {};

  for (const r of reqsData) {
    const soId = salesOrderMap[r.soNum];
    const soItmId = soItemMap[r.soNum];
    const custId = customerMap[r.custCode];

    const createdReq = await prisma.productionRequirement.upsert({
      where: { requirementNumber: r.num },
      update: {
        salesOrderId: soId,
        salesOrderItemId: soItmId,
        customerId: custId,
        requiredQuantity: r.qty,
        requiredDeliveryDate: new Date(Date.now() + 86400000 * 12),
        priority: r.prio,
        status: r.status,
        createdById: userMap[Role.SUPERVISOR]
      },
      create: {
        requirementNumber: r.num,
        salesOrderId: soId,
        salesOrderItemId: soItmId,
        customerId: custId,
        requiredQuantity: r.qty,
        requiredDeliveryDate: new Date(Date.now() + 86400000 * 12),
        priority: r.prio,
        status: r.status,
        createdById: userMap[Role.SUPERVISOR]
      }
    });
    reqMap[r.num] = createdReq.id;

    const planNum = r.num.replace("PRD-", "PLAN-");
    const planStatus = r.status === ProductionRequirementStatus.COMPLETED ? ProductionPlanStatus.COMPLETED : (r.status === ProductionRequirementStatus.IN_PRODUCTION ? ProductionPlanStatus.IN_PROGRESS : ProductionPlanStatus.RELEASED);

    const createdPlan = await prisma.productionPlan.upsert({
      where: { planNumber: planNum },
      update: {
        productionRequirementId: createdReq.id,
        plannedStartDate: new Date(Date.now() - 86400000 * 5),
        plannedCompletionDate: new Date(Date.now() + 86400000 * 5),
        priority: r.prio,
        plannedQuantity: r.qty,
        supervisorId: userMap[Role.SUPERVISOR],
        status: planStatus,
        createdById: userMap[Role.SUPERVISOR]
      },
      create: {
        planNumber: planNum,
        productionRequirementId: createdReq.id,
        plannedStartDate: new Date(Date.now() - 86400000 * 5),
        plannedCompletionDate: new Date(Date.now() + 86400000 * 5),
        priority: r.prio,
        plannedQuantity: r.qty,
        supervisorId: userMap[Role.SUPERVISOR],
        status: planStatus,
        createdById: userMap[Role.SUPERVISOR]
      }
    });
    planMap[planNum] = createdPlan.id;

    const woNum = r.num.replace("PRD-", "WO-");
    const bId = bomMap[r.bomName];
    const woStatus = r.status === ProductionRequirementStatus.COMPLETED ? WorkOrderStatus.COMPLETED : (r.status === ProductionRequirementStatus.IN_PRODUCTION ? WorkOrderStatus.IN_PROGRESS : WorkOrderStatus.READY);
    const compQty = r.status === ProductionRequirementStatus.COMPLETED ? r.qty : (r.status === ProductionRequirementStatus.IN_PRODUCTION ? Math.floor(r.qty / 2) : 0);

    const createdWO = await prisma.workOrder.upsert({
      where: { workOrderNumber: woNum },
      update: {
        productionPlanId: createdPlan.id,
        productionRequirementId: createdReq.id,
        salesOrderId: soId,
        bomId: bId,
        plannedQuantity: r.qty,
        startedQuantity: r.qty,
        completedQuantity: compQty,
        rejectedQuantity: 0,
        remainingQuantity: r.qty - compQty,
        dueDate: new Date(Date.now() + 86400000 * 8),
        supervisorId: userMap[Role.SUPERVISOR],
        status: woStatus
      },
      create: {
        workOrderNumber: woNum,
        productionPlanId: createdPlan.id,
        productionRequirementId: createdReq.id,
        salesOrderId: soId,
        bomId: bId,
        plannedQuantity: r.qty,
        startedQuantity: r.qty,
        completedQuantity: compQty,
        rejectedQuantity: 0,
        remainingQuantity: r.qty - compQty,
        dueDate: new Date(Date.now() + 86400000 * 8),
        supervisorId: userMap[Role.SUPERVISOR],
        status: woStatus
      }
    });
    woMap[woNum] = createdWO.id;

    // WO Operator Assignment
    const existingOp = await prisma.workOrderOperator.findFirst({ where: { workOrderId: createdWO.id } });
    if (!existingOp) {
      await prisma.workOrderOperator.create({
        data: {
          workOrderId: createdWO.id,
          userId: userMap[Role.ASSEMBLY_TECHNICIAN],
          role: "LEAD_OPERATOR",
          status: "ACTIVE"
        }
      });
    }

    // WO Scheduling & Execution
    await prisma.workOrderScheduling.upsert({
      where: { workOrderId: createdWO.id },
      update: { assignedDate: new Date(), sequence: 1, estimatedHrs: 16.5 },
      create: { workOrderId: createdWO.id, assignedDate: new Date(), sequence: 1, estimatedHrs: 16.5 }
    });

    await prisma.workOrderExecution.upsert({
      where: { workOrderId: createdWO.id },
      update: { startedAt: new Date(Date.now() - 86400000 * 3), actualHours: 14.2, completionNotes: "All cell spot welds and BMS soldering verified" },
      create: { workOrderId: createdWO.id, startedAt: new Date(Date.now() - 86400000 * 3), actualHours: 14.2, completionNotes: "All cell spot welds and BMS soldering verified" }
    });

    // Production Cell Testing Requirement (PCTR)
    await prisma.productionCellTestingRequirement.upsert({
      where: { workOrderId_cellSku: { workOrderId: createdWO.id, cellSku: "CELL-LFP-3200" } },
      update: {
        testedQuantity: compQty * 8,
        remainingQuantity: (r.qty - compQty) * 8,
        status: compQty === r.qty ? "COMPLETED" : "IN_PROGRESS"
      },
      create: {
        requirementNumber: `PCTR-${woNum}`,
        workOrderId: createdWO.id,
        cellSku: "CELL-LFP-3200",
        cellName: "LFP Cylindrical Cell 3.2V 3.2Ah (32650)",
        requiredQuantity: r.qty * 8,
        testedQuantity: compQty * 8,
        remainingQuantity: (r.qty - compQty) * 8,
        status: compQty === r.qty ? "COMPLETED" : "IN_PROGRESS"
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 10. Pax Pack Assembly, Quality Inspections & Defects
  // ---------------------------------------------------------------------------
  console.log("\n🔍 [10/12] Seeding 12 Pax Packs, 10 Quality Inspections, Checkpoints & 10 Defects...");

  const paxPacksData = [
    { serial: "PAX-2026-0001", ptName: "24V 50Ah LFP E-Rickshaw Battery Pack", bomName: "BOM-24V-50AH: 24V 50Ah E-Rickshaw Pack", status: PaxStatus.SOLD_TO_CUSTOMER, woNum: "WO-000101" },
    { serial: "PAX-2026-0002", ptName: "24V 50Ah LFP E-Rickshaw Battery Pack", bomName: "BOM-24V-50AH: 24V 50Ah E-Rickshaw Pack", status: PaxStatus.SOLD_TO_CUSTOMER, woNum: "WO-000101" },
    { serial: "PAX-2026-0003", ptName: "48V 100Ah Solar ESS High-Capacity Pack", bomName: "BOM-48V-100AH: 48V 100Ah Solar Energy Storage", status: PaxStatus.PAX_TESTED, woNum: "WO-000102" },
    { serial: "PAX-2026-0004", ptName: "48V 100Ah Solar ESS High-Capacity Pack", bomName: "BOM-48V-100AH: 48V 100Ah Solar Energy Storage", status: PaxStatus.READY_FOR_SALE, woNum: "WO-000102" },
    { serial: "PAX-2026-0005", ptName: "60V 30Ah EV Scooter High-Rate NMC Pack", bomName: "BOM-60V-30AH: 60V 30Ah EV Scooter Pack", status: PaxStatus.PAX_ASSEMBLED, woNum: "WO-000104" },
    { serial: "PAX-2026-0006", ptName: "72V 45Ah Delivery Fleet Heavy Duty Pack", bomName: "BOM-72V-45AH: 72V 45Ah Delivery Fleet Pack", status: PaxStatus.PAX_TESTED, woNum: "WO-000105" },
    { serial: "PAX-2026-0007", ptName: "72V 45Ah Delivery Fleet Heavy Duty Pack", bomName: "BOM-72V-45AH: 72V 45Ah Delivery Fleet Pack", status: PaxStatus.UNDER_REPAIR, woNum: "WO-000105" },
    { serial: "PAX-2026-0008", ptName: "48V 50Ah Telecom Tower Backup LFP Pack", bomName: "BOM-48V-50AH: 48V 50Ah Telecom Backup Pack", status: PaxStatus.SOLD_TO_CUSTOMER, woNum: "WO-000107" },
    { serial: "PAX-2026-0009", ptName: "48V 50Ah Telecom Tower Backup LFP Pack", bomName: "BOM-48V-50AH: 48V 50Ah Telecom Backup Pack", status: PaxStatus.SOLD_TO_CUSTOMER, woNum: "WO-000107" },
    { serial: "PAX-2026-0010", ptName: "60V 30Ah EV Scooter High-Rate NMC Pack", bomName: "BOM-60V-30AH: 60V 30Ah EV Scooter Pack", status: PaxStatus.SOLD_TO_CUSTOMER, woNum: "WO-000109" },
    { serial: "PAX-2026-0011", ptName: "12V 100Ah Marine & Caravan Deep Cycle Pack", bomName: "BOM-12V-100AH: 12V 100Ah Marine Deep Cycle", status: PaxStatus.READY_FOR_SALE, woNum: "WO-000106" },
    { serial: "PAX-2026-0012", ptName: "48V 100Ah Solar ESS High-Capacity Pack", bomName: "BOM-48V-100AH: 48V 100Ah Solar Energy Storage", status: PaxStatus.READY_FOR_SALE, woNum: "WO-000102" }
  ];

  for (let idx = 0; idx < paxPacksData.length; idx++) {
    const pp = paxPacksData[idx];
    const ptId = paxTypeMap[pp.ptName];
    const bId = bomMap[pp.bomName];
    const wId = woMap[pp.woNum];

    await prisma.paxPack.upsert({
      where: { paxSerial: pp.serial },
      update: {
        paxTypeId: ptId,
        bomId: bId,
        status: pp.status,
        workOrderId: wId,
        assembledAtStationId: stationMap["STN-ASM-01"],
        approvedBy: "Priya Sharma (QC Manager)",
        approvedAt: new Date(Date.now() - 86400000 * 2)
      },
      create: {
        paxSerial: pp.serial,
        paxTypeId: ptId,
        bomId: bId,
        status: pp.status,
        workOrderId: wId,
        assembledAtStationId: stationMap["STN-ASM-01"],
        approvedBy: "Priya Sharma (QC Manager)",
        approvedAt: new Date(Date.now() - 86400000 * 2)
      }
    });

    // Link cells into PaxPack
    for (let cPos = 1; cPos <= 4; cPos++) {
      const cellIdx = (idx * 4 + cPos - 1);
      if (cellIdx < cellSerials.length) {
        const cSerial = cellSerials[cellIdx];
        await prisma.paxCell.upsert({
          where: { paxSerial_cellSerial: { paxSerial: pp.serial, cellSerial: cSerial } },
          update: { position: cPos },
          create: { paxSerial: pp.serial, cellSerial: cSerial, position: cPos }
        });
      }
    }
  }

  // 10 Quality Inspections
  const inspectionsData = [
    { num: "QC-000101", woNum: "WO-000101", paxSerial: "PAX-2026-0001", type: "FINAL", result: "PASS", inspector: Role.QC },
    { num: "QC-000102", woNum: "WO-000101", paxSerial: "PAX-2026-0002", type: "FINAL", result: "PASS", inspector: Role.QC },
    { num: "QC-000103", woNum: "WO-000102", paxSerial: "PAX-2026-0003", type: "IN_PROCESS", result: "PASS", inspector: Role.TEST_ENGINEER },
    { num: "QC-000104", woNum: "WO-000102", paxSerial: "PAX-2026-0004", type: "FINAL", result: "PASS", inspector: Role.QC },
    { num: "QC-000105", woNum: "WO-000105", paxSerial: "PAX-2026-0006", type: "IN_PROCESS", result: "PASS", inspector: Role.TEST_ENGINEER },
    { num: "QC-000106", woNum: "WO-000105", paxSerial: "PAX-2026-0007", type: "FINAL", result: "FAIL", inspector: Role.QC },
    { num: "QC-000107", woNum: "WO-000107", paxSerial: "PAX-2026-0008", type: "FINAL", result: "PASS", inspector: Role.QC },
    { num: "QC-000108", woNum: "WO-000107", paxSerial: "PAX-2026-0009", type: "FINAL", result: "PASS", inspector: Role.QC },
    { num: "QC-000109", woNum: "WO-000109", paxSerial: "PAX-2026-0010", type: "FINAL", result: "PASS", inspector: Role.QC },
    { num: "QC-000110", woNum: "WO-000106", paxSerial: "PAX-2026-0011", type: "FINAL", result: "PASS", inspector: Role.QC }
  ];

  const inspMap: Record<string, string> = {};
  for (const ins of inspectionsData) {
    const wId = woMap[ins.woNum];
    const createdInsp = await prisma.qualityInspection.upsert({
      where: { inspectionNumber: ins.num },
      update: {
        workOrderId: wId,
        paxSerial: ins.paxSerial,
        inspectionType: ins.type,
        inspectorId: userMap[ins.inspector],
        status: "COMPLETED",
        result: ins.result,
        notes: `Standard 5-point QC Protocol executed: ${ins.result}`
      },
      create: {
        inspectionNumber: ins.num,
        workOrderId: wId,
        paxSerial: ins.paxSerial,
        inspectionType: ins.type,
        inspectorId: userMap[ins.inspector],
        status: "COMPLETED",
        result: ins.result,
        notes: `Standard 5-point QC Protocol executed: ${ins.result}`
      }
    });
    inspMap[ins.num] = createdInsp.id;

    // Add checkpoints
    const checkpoints = [
      { name: "OCV Voltage Balance Delta", exp: "< 15mV", act: ins.result === "PASS" ? "6mV" : "48mV", res: ins.result },
      { name: "Hi-Pot Insulation Resistance", exp: "> 500 MΩ @ 1000V", act: "850 MΩ", res: "PASS" },
      { name: "BMS UART/CAN Communication", exp: "100% telemetry stream", act: "Active", res: "PASS" }
    ];

    for (const cp of checkpoints) {
      const existingCP = await prisma.qualityCheckpoint.findFirst({
        where: { inspectionId: createdInsp.id, name: cp.name }
      });
      if (!existingCP) {
        await prisma.qualityCheckpoint.create({
          data: {
            inspectionId: createdInsp.id,
            name: cp.name,
            expectedValue: cp.exp,
            actualValue: cp.act,
            result: cp.res
          }
        });
      }
    }
  }

  // 10 Defects & Repairs
  const defectsData = [
    { num: "DEF-000101", pax: "PAX-2026-0007", insp: "QC-000106", type: "Cell Voltage Imbalance", sev: "HIGH", desc: "Cell #4 showing 48mV delta deviation after high current pulse", disp: "REWORK", status: "UNDER_REVIEW" },
    { num: "DEF-000102", pax: "PAX-2026-0005", insp: null, type: "Spot Weld Micro-Crack", sev: "MEDIUM", desc: "Nickel busbar weld joint #7 incomplete penetration", disp: "REWORK", status: "RESOLVED" },
    { num: "DEF-000103", pax: null, insp: null, type: "BMS Telemetry Timeout", sev: "MEDIUM", desc: "CAN bus packet loss during thermal runaway simulation", disp: "REPAIR", status: "RESOLVED" },
    { num: "DEF-000104", pax: null, insp: null, type: "Enclosure Gasket Misaligned", sev: "LOW", desc: "IP67 silicone bead offset by 2mm near main cable gland", disp: "REWORK", status: "RESOLVED" },
    { num: "DEF-000105", pax: null, insp: null, type: "High Internal Resistance Outlier", sev: "HIGH", desc: "Incoming cell batch cell #12 IR measured 68mΩ (max 42mΩ)", disp: "SCRAP", status: "RESOLVED" },
    { num: "DEF-000106", pax: null, insp: null, type: "Crimping Pull Force Defect", sev: "MEDIUM", desc: "Lug terminal wire pull test failed at 180N (spec > 250N)", disp: "REWORK", status: "RESOLVED" },
    { num: "DEF-000107", pax: null, insp: null, type: "Thermal Pad Air Bubble Gap", sev: "LOW", desc: "Air void under 2mm thermal pad on aluminum heat sink plate", disp: "REWORK", status: "RESOLVED" },
    { num: "DEF-000108", pax: null, insp: null, type: "Fuse Carrier Thread Burred", sev: "LOW", desc: "M4 screw binding on brass standoff thread", disp: "REWORK", status: "RESOLVED" },
    { num: "DEF-000109", pax: null, insp: null, type: "Damaged PET Insulation Sheet", sev: "HIGH", desc: "Scratch found on barrier sheet between cell layers", disp: "SCRAP", status: "RESOLVED" },
    { num: "DEF-000110", pax: null, insp: null, type: "QR Label Smudged Barcode", sev: "LOW", desc: "Thermal ribbon smudged on finished pack front face", disp: "REWORK", status: "RESOLVED" }
  ];

  for (const def of defectsData) {
    const createdDef = await prisma.defect.upsert({
      where: { defectNumber: def.num },
      update: {
        paxSerial: def.pax,
        inspectionId: def.insp ? inspMap[def.insp] : null,
        defectType: def.type,
        severity: def.sev,
        description: def.desc,
        disposition: def.disp,
        status: def.status,
        reportedById: userMap[Role.QC],
        resolvedById: def.status === "RESOLVED" ? userMap[Role.ASSEMBLY_TECHNICIAN] : null
      },
      create: {
        defectNumber: def.num,
        paxSerial: def.pax,
        inspectionId: def.insp ? inspMap[def.insp] : null,
        defectType: def.type,
        severity: def.sev,
        description: def.desc,
        disposition: def.disp,
        status: def.status,
        reportedById: userMap[Role.QC],
        resolvedById: def.status === "RESOLVED" ? userMap[Role.ASSEMBLY_TECHNICIAN] : null
      }
    });

    if (def.pax) {
      const existingRep = await prisma.repair.findFirst({ where: { paxSerial: def.pax } });
      if (!existingRep) {
        await prisma.repair.create({
          data: {
            paxSerial: def.pax,
            fixType: "Replaced cell & re-balanced pack",
            diagnosisNotes: def.desc,
            repairedBy: "Deepak Nair (Assembly Tech)",
            reTestResult: "PASS (OCV Delta < 4mV)",
            defectId: createdDef.id
          }
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 11. Logistics & Dispatch: 10 DOs, Packages & Shipments
  // ---------------------------------------------------------------------------
  console.log("\n📦 [11/12] Seeding 10 Dispatch Orders, Packages, Shipments & Proofs of Delivery...");

  const dosData = [
    { num: "DO-000101", soNum: "SO-000101", custCode: "CUS-000101", status: "DELIVERED", carrier: "SafeXpress Logistics", trk: "SFX-88992011", pax: "PAX-2026-0001" },
    { num: "DO-000102", soNum: "SO-000102", custCode: "CUS-000102", status: "DISPATCHED", carrier: "Blue Dart Apex", trk: "BLU-44556677", pax: "PAX-2026-0003" },
    { num: "DO-000103", soNum: "SO-000103", custCode: "CUS-000103", status: "PACKED", carrier: "DTDC Express Heavy", trk: "DTC-11223344", pax: null },
    { num: "DO-000104", soNum: "SO-000105", custCode: "CUS-000105", status: "DISPATCHED", carrier: "Delhivery Freight", trk: "DLV-99001122", pax: "PAX-2026-0006" },
    { num: "DO-000105", soNum: "SO-000107", custCode: "CUS-000107", status: "DELIVERED", carrier: "SafeXpress Logistics", trk: "SFX-33445566", pax: "PAX-2026-0008" },
    { num: "DO-000106", soNum: "SO-000109", custCode: "CUS-000109", status: "DELIVERED", carrier: "Blue Dart Express", trk: "BLU-77889900", pax: "PAX-2026-0010" },
    { num: "DO-000107", soNum: "SO-000102", custCode: "CUS-000102", status: "READY_TO_PICK", carrier: "TCI Express", trk: "TCI-66778899", pax: "PAX-2026-0004" },
    { num: "DO-000108", soNum: "SO-000104", custCode: "CUS-000104", status: "DRAFT", carrier: "DTDC Express", trk: null, pax: null },
    { num: "DO-000109", soNum: "SO-000106", custCode: "CUS-000106", status: "DRAFT", carrier: "VRL Logistics", trk: null, pax: null },
    { num: "DO-000110", soNum: "SO-000108", custCode: "CUS-000108", status: "DRAFT", carrier: "Gati KWE", trk: null, pax: null }
  ];

  const doMap: Record<string, string> = {};

  for (const d of dosData) {
    const soId = salesOrderMap[d.soNum];
    const custId = customerMap[d.custCode];
    const cust = customersData.find(c => c.code === d.custCode)!;

    const createdDO = await prisma.dispatchOrder.upsert({
      where: { dispatchNumber: d.num },
      update: {
        salesOrderId: soId,
        customerId: custId,
        createdById: userMap[Role.INVENTORY_MANAGER],
        assignedUserId: userMap[Role.INVENTORY_MANAGER],
        plannedDispatchDate: new Date(),
        dispatchDate: (d.status === "DISPATCHED" || d.status === "DELIVERED") ? new Date(Date.now() - 86400000 * 2) : null,
        deliveryAddressSnapshot: cust.address,
        status: d.status,
        carrier: d.carrier,
        trackingNumber: d.trk
      },
      create: {
        dispatchNumber: d.num,
        salesOrderId: soId,
        customerId: custId,
        createdById: userMap[Role.INVENTORY_MANAGER],
        assignedUserId: userMap[Role.INVENTORY_MANAGER],
        plannedDispatchDate: new Date(),
        dispatchDate: (d.status === "DISPATCHED" || d.status === "DELIVERED") ? new Date(Date.now() - 86400000 * 2) : null,
        deliveryAddressSnapshot: cust.address,
        status: d.status,
        carrier: d.carrier,
        trackingNumber: d.trk
      }
    });
    doMap[d.num] = createdDO.id;

    // Dispatch Item
    const soItmId = soItemMap[d.soNum];
    const existingDOItem = await prisma.dispatchItem.findFirst({
      where: { dispatchOrderId: createdDO.id }
    });
    if (!existingDOItem) {
      await prisma.dispatchItem.create({
        data: {
          dispatchOrderId: createdDO.id,
          salesOrderItemId: soItmId,
          quantityOrdered: 10,
          quantityDispatched: 10,
          quantityPicked: 10,
          quantityPacked: 10,
          quantityDelivered: d.status === "DELIVERED" ? 10 : 0,
          paxSerial: d.pax
        }
      });
    }

    // Delivery Package & Shipment
    const pkgNum = d.num.replace("DO-", "PKG-");
    await prisma.deliveryPackage.upsert({
      where: { packageNumber: pkgNum },
      update: { dispatchOrderId: createdDO.id, weight: 45.5, packageType: "HEAVY_DUTY_WOODEN_CRATE", trackingReference: d.trk },
      create: { packageNumber: pkgNum, dispatchOrderId: createdDO.id, weight: 45.5, packageType: "HEAVY_DUTY_WOODEN_CRATE", trackingReference: d.trk }
    });

    if (d.trk) {
      const shipNum = d.num.replace("DO-", "SHIP-");
      const createdShipment = await prisma.shipment.upsert({
        where: { shipmentNumber: shipNum },
        update: {
          dispatchOrderId: createdDO.id,
          carrier: d.carrier,
          shippingMethod: "SURFACE_EXPRESS",
          trackingNumber: d.trk,
          status: d.status === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT"
        },
        create: {
          shipmentNumber: shipNum,
          dispatchOrderId: createdDO.id,
          carrier: d.carrier,
          shippingMethod: "SURFACE_EXPRESS",
          trackingNumber: d.trk,
          status: d.status === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT"
        }
      });

      if (d.status === "DELIVERED") {
        const existingPOD = await prisma.proofOfDelivery.findFirst({
          where: { shipmentId: createdShipment.id }
        });
        if (!existingPOD) {
          await prisma.proofOfDelivery.create({
            data: {
              shipmentId: createdShipment.id,
              recipientName: cust.contact,
              recipientContact: cust.phone,
              deliveredBy: `${d.carrier} Driver #882`,
              deliveryNotes: "Customer verified intact factory tamper-evident seal"
            }
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 12. Finance & RMA: Invoices, Payments, Warranties, Service & Scrap (10 of each)
  // ---------------------------------------------------------------------------
  console.log("\n💰 [12/12] Seeding 10 Invoices, 10 Payments, 10 Warranties, 10 Service RMA & 10 Scrap Entries...");

  // Invoices (10)
  const invoicesData = [
    { num: "INV-000101", soNum: "SO-000101", custCode: "CUS-000101", status: "PAID", sub: 1250000, tax: 225000, grand: 1475000, paid: 1475000, out: 0 },
    { num: "INV-000102", soNum: "SO-000102", custCode: "CUS-000102", status: "PARTIALLY_PAID", sub: 1900000, tax: 342000, grand: 2242000, paid: 1121000, out: 1121000 },
    { num: "INV-000103", soNum: "SO-000103", custCode: "CUS-000103", status: "PARTIALLY_PAID", sub: 840000, tax: 151200, grand: 991200, paid: 500000, out: 491200 },
    { num: "INV-000104", soNum: "SO-000104", custCode: "CUS-000104", status: "ISSUED", sub: 480000, tax: 86400, grand: 566400, paid: 0, out: 566400 },
    { num: "INV-000105", soNum: "SO-000105", custCode: "CUS-000105", status: "PAID", sub: 1620000, tax: 291600, grand: 1911600, paid: 1911600, out: 0 },
    { num: "INV-000106", soNum: "SO-000106", custCode: "CUS-000106", status: "ISSUED", sub: 620000, tax: 111600, grand: 731600, paid: 0, out: 731600 },
    { num: "INV-000107", soNum: "SO-000107", custCode: "CUS-000107", status: "PAID", sub: 1400000, tax: 252000, grand: 1652000, paid: 1652000, out: 0 },
    { num: "INV-000108", soNum: "SO-000108", custCode: "CUS-000108", status: "ISSUED", sub: 780000, tax: 140400, grand: 920400, paid: 0, out: 920400 },
    { num: "INV-000109", soNum: "SO-000109", custCode: "CUS-000109", status: "PAID", sub: 38000, tax: 6840, grand: 44840, paid: 44840, out: 0 },
    { num: "INV-000110", soNum: "SO-000110", custCode: "CUS-000110", status: "ISSUED", sub: 1150000, tax: 207000, grand: 1357000, paid: 0, out: 1357000 }
  ];

  const invMap: Record<string, string> = {};

  for (const inv of invoicesData) {
    const custId = customerMap[inv.custCode];
    const soId = salesOrderMap[inv.soNum];
    const cust = customersData.find(c => c.code === inv.custCode)!;

    const createdInv = await prisma.invoice.upsert({
      where: { invoiceNumber: inv.num },
      update: {
        customerId: custId,
        salesOrderId: soId,
        invoiceDate: new Date(Date.now() - 86400000 * 4),
        dueDate: new Date(Date.now() + 86400000 * 26),
        status: inv.status,
        subtotal: inv.sub,
        discount: 0,
        taxableAmount: inv.sub,
        tax: inv.tax,
        grandTotal: inv.grand,
        paidAmount: inv.paid,
        outstandingAmount: inv.out,
        paymentTerms: "30 Days Net",
        billingAddressSnapshot: cust.address,
        shippingAddressSnapshot: cust.address,
        createdById: userMap[Role.ACCOUNTANT]
      },
      create: {
        invoiceNumber: inv.num,
        customerId: custId,
        salesOrderId: soId,
        invoiceDate: new Date(Date.now() - 86400000 * 4),
        dueDate: new Date(Date.now() + 86400000 * 26),
        status: inv.status,
        subtotal: inv.sub,
        discount: 0,
        taxableAmount: inv.sub,
        tax: inv.tax,
        grandTotal: inv.grand,
        paidAmount: inv.paid,
        outstandingAmount: inv.out,
        paymentTerms: "30 Days Net",
        billingAddressSnapshot: cust.address,
        shippingAddressSnapshot: cust.address,
        createdById: userMap[Role.ACCOUNTANT]
      }
    });
    invMap[inv.num] = createdInv.id;

    const existingInvItem = await prisma.invoiceItem.findFirst({
      where: { invoiceId: createdInv.id }
    });
    if (!existingInvItem) {
      await prisma.invoiceItem.create({
        data: {
          invoiceId: createdInv.id,
          description: `Invoice item for ${inv.soNum}`,
          quantity: 10,
          unitPrice: inv.sub / 10,
          discount: 0,
          taxRate: 18.0,
          taxAmount: inv.tax,
          lineSubtotal: inv.sub,
          lineTotal: inv.grand
        }
      });
    }
  }

  // Payments (10)
  const paymentsData = [
    { ref: "PAY-000101", invNum: "INV-000101", soNum: "SO-000101", custCode: "CUS-000101", amt: 1475000, meth: "BANK_TRANSFER", refNum: "HDFC-RTGS-9901122" },
    { ref: "PAY-000102", invNum: "INV-000102", soNum: "SO-000102", custCode: "CUS-000102", amt: 1121000, meth: "BANK_TRANSFER", refNum: "ICICI-NEFT-3344556" },
    { ref: "PAY-000103", invNum: "INV-000103", soNum: "SO-000103", custCode: "CUS-000103", amt: 500000, meth: "CHEQUE", refNum: "CHQ-889901" },
    { ref: "PAY-000104", invNum: "INV-000105", soNum: "SO-000105", custCode: "CUS-000105", amt: 1911600, meth: "BANK_TRANSFER", refNum: "AXIS-RTGS-5566778" },
    { ref: "PAY-000105", invNum: "INV-000107", soNum: "SO-000107", custCode: "CUS-000107", amt: 1652000, meth: "BANK_TRANSFER", refNum: "SBI-RTGS-1122334" },
    { ref: "PAY-000106", invNum: "INV-000109", soNum: "SO-000109", custCode: "CUS-000109", amt: 44840, meth: "UPI", refNum: "UPI-ICICI-445566778899" },
    { ref: "PAY-000107", invNum: null, soNum: "SO-000104", custCode: "CUS-000104", amt: 283200, meth: "BANK_TRANSFER", refNum: "KOTAK-ADV-990011" },
    { ref: "PAY-000108", invNum: null, soNum: "SO-000106", custCode: "CUS-000106", amt: 365800, meth: "CHEQUE", refNum: "CHQ-110022" },
    { ref: "PAY-000109", invNum: null, soNum: "SO-000108", custCode: "CUS-000108", amt: 460200, meth: "BANK_TRANSFER", refNum: "BOB-RTGS-889900" },
    { ref: "PAY-000110", invNum: null, soNum: "SO-000110", custCode: "CUS-000110", amt: 678500, meth: "BANK_TRANSFER", refNum: "PNB-NEFT-667788" }
  ];

  for (const p of paymentsData) {
    const custId = customerMap[p.custCode];
    const invId = p.invNum ? invMap[p.invNum] : null;
    const soId = salesOrderMap[p.soNum];

    await prisma.payment.upsert({
      where: { paymentReference: p.ref },
      update: {
        customerId: custId,
        invoiceId: invId,
        salesOrderId: soId,
        amount: p.amt,
        paymentMethod: p.meth,
        referenceNumber: p.refNum,
        status: "VERIFIED",
        recordedById: userMap[Role.ACCOUNTANT],
        verifiedById: userMap[Role.ACCOUNTANT],
        verifiedAt: new Date()
      },
      create: {
        paymentReference: p.ref,
        customerId: custId,
        invoiceId: invId,
        salesOrderId: soId,
        amount: p.amt,
        paymentMethod: p.meth,
        referenceNumber: p.refNum,
        status: "VERIFIED",
        recordedById: userMap[Role.ACCOUNTANT],
        verifiedById: userMap[Role.ACCOUNTANT],
        verifiedAt: new Date()
      }
    });
  }

  // Warranties (10)
  const warrantiesData = [
    { num: "WAR-000101", custCode: "CUS-000101", pax: "PAX-2026-0001", soNum: "SO-000101", invNum: "INV-000101", months: 36, status: "ACTIVE" },
    { num: "WAR-000102", custCode: "CUS-000101", pax: "PAX-2026-0002", soNum: "SO-000101", invNum: "INV-000101", months: 36, status: "ACTIVE" },
    { num: "WAR-000103", custCode: "CUS-000102", pax: "PAX-2026-0003", soNum: "SO-000102", invNum: "INV-000102", months: 60, status: "ACTIVE" },
    { num: "WAR-000104", custCode: "CUS-000102", pax: "PAX-2026-0004", soNum: "SO-000102", invNum: "INV-000102", months: 60, status: "ACTIVE" },
    { num: "WAR-000105", custCode: "CUS-000105", pax: "PAX-2026-0006", soNum: "SO-000105", invNum: "INV-000105", months: 24, status: "ACTIVE" },
    { num: "WAR-000106", custCode: "CUS-000105", pax: "PAX-2026-0007", soNum: "SO-000105", invNum: "INV-000105", months: 24, status: "CLAIMED" },
    { num: "WAR-000107", custCode: "CUS-000107", pax: "PAX-2026-0008", soNum: "SO-000107", invNum: "INV-000107", months: 36, status: "ACTIVE" },
    { num: "WAR-000108", custCode: "CUS-000107", pax: "PAX-2026-0009", soNum: "SO-000107", invNum: "INV-000107", months: 36, status: "ACTIVE" },
    { num: "WAR-000109", custCode: "CUS-000109", pax: "PAX-2026-0010", soNum: "SO-000109", invNum: "INV-000109", months: 24, status: "ACTIVE" },
    { num: "WAR-000110", custCode: "CUS-000106", pax: "PAX-2026-0011", soNum: "SO-000106", invNum: "INV-000106", months: 36, status: "ACTIVE" }
  ];

  for (const w of warrantiesData) {
    const custId = customerMap[w.custCode];
    const soId = salesOrderMap[w.soNum];
    const invId = invMap[w.invNum];

    await prisma.warranty.upsert({
      where: { warrantyNumber: w.num },
      update: {
        customerId: custId,
        paxSerial: w.pax,
        salesOrderId: soId,
        invoiceId: invId,
        deliveryDate: new Date(Date.now() - 86400000 * 30),
        warrantyStartDate: new Date(Date.now() - 86400000 * 30),
        warrantyEndDate: new Date(Date.now() + 86400000 * (w.months * 30)),
        warrantyDurationMonths: w.months,
        status: w.status,
        coverageType: "FULL",
        terms: "100% replacement for cell degradation > 20% in first 24 months"
      },
      create: {
        warrantyNumber: w.num,
        customerId: custId,
        paxSerial: w.pax,
        salesOrderId: soId,
        invoiceId: invId,
        deliveryDate: new Date(Date.now() - 86400000 * 30),
        warrantyStartDate: new Date(Date.now() - 86400000 * 30),
        warrantyEndDate: new Date(Date.now() + 86400000 * (w.months * 30)),
        warrantyDurationMonths: w.months,
        status: w.status,
        coverageType: "FULL",
        terms: "100% replacement for cell degradation > 20% in first 24 months"
      }
    });
  }

  // Service Batteries (10)
  const serviceData = [
    { srvId: "SRV-2026-000101", serial: "SRV-SER-0001", cust: "VoltCharge Fleet Operations Ltd", mob: "+91 98400 99005", model: "72V 45Ah Delivery Fleet Pack", issue: "BMS shuts off at 35% state of charge during acceleration", status: ServiceStatus.REPAIR_IN_PROGRESS },
    { srvId: "SRV-2026-000102", serial: "SRV-SER-0002", cust: "ElectroRide Mobility Pvt Ltd", mob: "+91 98200 11221", model: "24V 50Ah LFP Pack", issue: "Cell group #3 voltage showing 0.8V drop after overnight rain", status: ServiceStatus.DIAGNOSIS_COMPLETED },
    { srvId: "SRV-2026-000103", serial: "SRV-SER-0003", cust: "SuryaShakti Solar Solutions Ltd", mob: "+91 98220 33442", model: "48V 100Ah Solar ESS Unit", issue: "Inverter communication error: CAN bus timeout on battery #2", status: ServiceStatus.READY_FOR_DELIVERY },
    { srvId: "SRV-2026-000104", serial: "SRV-SER-0004", cust: "Rajesh Kumar", mob: "+91 98190 22349", model: "60V 30Ah EV Scooter Pack", issue: "Charger port pin bent and thermal fuse tripped", status: ServiceStatus.DELIVERED },
    { srvId: "SRV-2026-000105", serial: "SRV-SER-0005", cust: "GreenE-Rickshaw Fleet India", mob: "+91 98110 55663", model: "24V 50Ah Commercial Pack", issue: "Mileage dropped from 85km to 45km after 18 months of intensive use", status: ServiceStatus.ESTIMATE_GENERATED },
    { srvId: "SRV-2026-000106", serial: "SRV-SER-0006", cust: "AeroDrone Logistics Technologies", mob: "+91 98490 77884", model: "6S High Discharge Drone Battery", issue: "Cell puffing observed after heavy payload mission in summer", status: ServiceStatus.SCRAP_RECOMMENDED },
    { srvId: "SRV-2026-000107", serial: "SRV-SER-0007", cust: "BlueMarine Nautical Works", mob: "+91 98470 11236", model: "12V 100Ah Marine Pack", issue: "Enclosure seal salt corrosion near terminal bolts", status: ServiceStatus.REPAIR_COMPLETED },
    { srvId: "SRV-2026-000108", serial: "SRV-SER-0008", cust: "TelecomCell Infra Towers Corp", mob: "+91 98250 44557", model: "48V 50Ah Telecom Pack", issue: "High ambient temperature alarm logged in BMS memory", status: ServiceStatus.RECEIVED },
    { srvId: "SRV-2026-000109", serial: "SRV-SER-0009", cust: "Kisan Agrotech Solar Pumps", mob: "+91 98260 77888", model: "48V 100Ah Agri Solar Pack", issue: "Lightning surge tripped input breaker diode", status: ServiceStatus.MATERIAL_REQUESTED },
    { srvId: "SRV-2026-0010", serial: "SRV-SER-0010", cust: "Vikramaditya Power Labs", mob: "+91 98300 66770", model: "48V 100Ah Industrial Pack", issue: "Annual preventive maintenance & comprehensive cycle testing", status: ServiceStatus.RECEIVED }
  ];

  for (const s of serviceData) {
    const createdSRV = await prisma.serviceBattery.upsert({
      where: { serviceId: s.srvId },
      update: {
        serialNumber: s.serial,
        customerName: s.cust,
        customerMobile: s.mob,
        batteryModel: s.model,
        issueDescription: s.issue,
        status: s.status,
        warrantyStatus: "IN_WARRANTY",
        createdBy: "Ravi Kumar (Service Incharge)"
      },
      create: {
        serviceId: s.srvId,
        serialNumber: s.serial,
        customerName: s.cust,
        customerMobile: s.mob,
        batteryModel: s.model,
        issueDescription: s.issue,
        status: s.status,
        warrantyStatus: "IN_WARRANTY",
        createdBy: "Ravi Kumar (Service Incharge)"
      }
    });

    // Add Service Estimate & Cost
    await prisma.serviceCost.upsert({
      where: { serviceBatteryId: createdSRV.id },
      update: {
        serviceType: "Cell Balancing & BMS Rework",
        materialCost: 1250,
        labourCost: 850,
        marginPercentage: 20,
        marginAmount: 420,
        totalCost: 2520,
        amountPaid: s.status === ServiceStatus.DELIVERED ? 2520 : 0
      },
      create: {
        serviceBatteryId: createdSRV.id,
        serviceType: "Cell Balancing & BMS Rework",
        materialCost: 1250,
        labourCost: 850,
        marginPercentage: 20,
        marginAmount: 420,
        totalCost: 2520,
        amountPaid: s.status === ServiceStatus.DELIVERED ? 2520 : 0
      }
    });

    await prisma.serviceEstimate.upsert({
      where: { serviceBatteryId: createdSRV.id },
      update: {
        materialCost: 1250,
        labourCost: 850,
        marginAmount: 420,
        totalEstimate: 2520,
        remarks: "Approved under standard SLA",
        approvedByCustomer: true,
        approvalMethod: ApprovalMethod.WHATSAPP
      },
      create: {
        serviceBatteryId: createdSRV.id,
        materialCost: 1250,
        labourCost: 850,
        marginAmount: 420,
        totalEstimate: 2520,
        remarks: "Approved under standard SLA",
        approvedByCustomer: true,
        approvalMethod: ApprovalMethod.WHATSAPP
      }
    });

    // Add Repair Log
    const existingLog = await prisma.serviceRepairLog.findFirst({
      where: { serviceBatteryId: createdSRV.id }
    });
    if (!existingLog) {
      await prisma.serviceRepairLog.create({
        data: {
          serviceBatteryId: createdSRV.id,
          action: "Diagnostic scan & load cycle run",
          notes: s.issue,
          technicianId: userMap[Role.ASSEMBLY_TECHNICIAN]
        }
      });
    }
  }

  // Scrap Entries (10)
  const scrapsData = [
    { num: "SCRAP-000101", type: ScrapType.PROFITABLE, src: ScrapSource.TESTING, sku: "CELL-18650-50AH", qty: 24, cost: 450, rec: 150, def: "Degraded Capacity Outlier (<70%)", sev: SeverityLevel.HIGH, stat: ScrapStatus.STORED },
    { num: "SCRAP-000102", type: ScrapType.PROFITABLE, src: ScrapSource.PRODUCTION, sku: "BUS-CU-20MM", qty: 85, cost: 85, rec: 65, def: "Off-cut Copper Busbar Trimmings", sev: SeverityLevel.LOW, stat: ScrapStatus.SOLD },
    { num: "SCRAP-000103", type: ScrapType.LOSS, src: ScrapSource.ASSEMBLY, sku: "ENC-ABS-MD", qty: 6, cost: 680, rec: 50, def: "Warped ABS Casing After Thermal Test", sev: SeverityLevel.MEDIUM, stat: ScrapStatus.STORED },
    { num: "SCRAP-000104", type: ScrapType.LOSS, src: ScrapSource.SERVICE, sku: "BMS-16S-100A", qty: 4, cost: 1250, rec: 100, def: "Overvoltage MOS Burnout from Surge", sev: SeverityLevel.CRITICAL, stat: ScrapStatus.SCRAPPED },
    { num: "SCRAP-000105", type: ScrapType.PROFITABLE, src: ScrapSource.PRODUCTION, sku: "BUS-NI-30MM", qty: 40, cost: 145, rec: 110, def: "Nickel-Plated Copper Shaving Scraps", sev: SeverityLevel.LOW, stat: ScrapStatus.SOLD },
    { num: "SCRAP-000106", type: ScrapType.LOSS, src: ScrapSource.INVENTORY_DAMAGE, sku: "INS-FP-SHEET", qty: 15, cost: 15, rec: 0, def: "Moisture Penetration in Warehouse Bin", sev: SeverityLevel.MEDIUM, stat: ScrapStatus.DISPOSED },
    { num: "SCRAP-000107", type: ScrapType.PROFITABLE, src: ScrapSource.RETURNED_PRODUCT, sku: "CELL-32140-100AH", qty: 12, cost: 850, rec: 280, def: "Deep Discharged Cells from Inactive Return", sev: SeverityLevel.HIGH, stat: ScrapStatus.STORED },
    { num: "SCRAP-000108", type: ScrapType.LOSS, src: ScrapSource.ASSEMBLY, sku: "FAST-M5-BOLT", qty: 120, cost: 4, rec: 1, def: "Stripped Hex Bolt Heads During Torque Test", sev: SeverityLevel.LOW, stat: ScrapStatus.RECYCLED },
    { num: "SCRAP-000109", type: ScrapType.LOSS, src: ScrapSource.SERVICE, sku: "WIRE-6AWG-RED", qty: 18, cost: 180, rec: 45, def: "Charred Wire Ends from Field Short Circuit", sev: SeverityLevel.HIGH, stat: ScrapStatus.STORED },
    { num: "SCRAP-000110", type: ScrapType.PROFITABLE, src: ScrapSource.PRODUCTION, sku: "ENC-AL-LG", qty: 5, cost: 1850, rec: 750, def: "Milled Aluminium Heat Sink Shavings", sev: SeverityLevel.LOW, stat: ScrapStatus.SOLD }
  ];

  for (const sc of scrapsData) {
    const matId = materialMap[sc.sku];
    const mat = FACTORY_DEMO_MATERIALS.find(m => m.sku === sc.sku)!;

    const createdScrap = await prisma.scrapEntry.upsert({
      where: { scrapId: sc.num },
      update: {
        scrapType: sc.type,
        sourceType: sc.src,
        status: sc.stat,
        materialId: matId,
        materialName: mat.name,
        sku: sc.sku,
        quantity: sc.qty,
        unitCost: sc.cost,
        totalCost: sc.cost * sc.qty,
        estimatedRecoveryValue: sc.rec * sc.qty,
        defectType: sc.def,
        severity: sc.sev,
        description: `Scrap record for ${sc.def}`,
        createdBy: userMap[Role.QC],
        approvedBy: userMap[Role.SUPERVISOR]
      },
      create: {
        scrapId: sc.num,
        scrapType: sc.type,
        sourceType: sc.src,
        status: sc.stat,
        materialId: matId,
        materialName: mat.name,
        sku: sc.sku,
        quantity: sc.qty,
        unitCost: sc.cost,
        totalCost: sc.cost * sc.qty,
        estimatedRecoveryValue: sc.rec * sc.qty,
        defectType: sc.def,
        severity: sc.sev,
        description: `Scrap record for ${sc.def}`,
        createdBy: userMap[Role.QC],
        approvedBy: userMap[Role.SUPERVISOR]
      }
    });

    // Scrap Inventory
    await prisma.scrapInventory.upsert({
      where: { scrapEntryId: createdScrap.id },
      update: { quantity: sc.qty, location: "SRV-SCR", estimatedValue: sc.rec * sc.qty, currentStatus: sc.stat },
      create: { scrapEntryId: createdScrap.id, quantity: sc.qty, location: "SRV-SCR", estimatedValue: sc.rec * sc.qty, currentStatus: sc.stat }
    });

    if (sc.stat === ScrapStatus.SOLD) {
      const existingSale = await prisma.scrapSale.findFirst({
        where: { scrapEntryId: createdScrap.id }
      });
      if (!existingSale) {
        await prisma.scrapSale.create({
          data: {
            scrapEntryId: createdScrap.id,
            buyerName: "Maharashtra Metal Recyclers Pvt Ltd",
            quantitySold: sc.qty,
            salePrice: sc.rec * sc.qty,
            remarks: "Recycling batch invoice settled via NEFT"
          }
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Stock Movements (15) & Stock Transfers (6)
  // ---------------------------------------------------------------------------
  console.log("\n🔄 Seeding Stock Movements & Warehouse Stock Transfers...");

  const movementsData = [
    { sku: "CELL-18650-50AH", qty: 500, type: StockMovementType.RECEIPT, reason: "Inward GRN-000101 receipt" },
    { sku: "CELL-18650-50AH", qty: -160, type: StockMovementType.ISSUE, reason: "Issued to WO-000101 production line" },
    { sku: "BMS-16S-100A", qty: 30, type: StockMovementType.RECEIPT, reason: "Inward GRN-000102 receipt" },
    { sku: "BMS-16S-100A", qty: -10, type: StockMovementType.ISSUE, reason: "Issued to WO-000102 production line" },
    { sku: "BUS-CU-20MM", qty: 150, type: StockMovementType.RECEIPT, reason: "Inward GRN-000103 receipt" },
    { sku: "BUS-CU-20MM", qty: -70, type: StockMovementType.ISSUE, reason: "Issued to WO-000101 production line" },
    { sku: "ENC-AL-LG", qty: 30, type: StockMovementType.RECEIPT, reason: "Inward GRN-000105 receipt" },
    { sku: "ENC-AL-LG", qty: -10, type: StockMovementType.ISSUE, reason: "Issued to WO-000102 production line" }
  ];

  for (const m of movementsData) {
    const matId = materialMap[m.sku];
    await prisma.stockMovement.create({
      data: {
        materialId: matId,
        quantity: m.qty,
        movementType: m.type,
        source: "WAREHOUSE_TRANSACTION",
        warehouseId: warehouseMap["WH-RAW"],
        locationId: locationMap["RAW-A01"],
        userId: userMap[Role.INVENTORY_MANAGER],
        reason: m.reason
      }
    });
  }

  const transfersData = [
    { num: "TRF-000101", from: "WH-RAW", to: "WH-ASM", status: "RECEIVED", sku: "CELL-18650-50AH", qty: 160 },
    { num: "TRF-000102", from: "WH-RAW", to: "WH-ASM", status: "RECEIVED", sku: "BUS-CU-20MM", qty: 100 },
    { num: "TRF-000103", from: "WH-RAW", to: "WH-ASM", status: "RECEIVED", sku: "BMS-16S-100A", qty: 20 },
    { num: "TRF-000104", from: "WH-RAW", to: "WH-SRV", status: "RECEIVED", sku: "BMS-4S-40A", qty: 15 },
    { num: "TRF-000105", from: "WH-RAW", to: "WH-ASM", status: "IN_TRANSIT", sku: "WIRE-6AWG-RED", qty: 50 },
    { num: "TRF-000106", from: "WH-RAW", to: "WH-ASM", status: "REQUESTED", sku: "ENC-AL-LG", qty: 12 }
  ];

  for (const tr of transfersData) {
    const matId = materialMap[tr.sku];
    const createdTrf = await prisma.stockTransfer.upsert({
      where: { transferNumber: tr.num },
      update: {
        originWarehouseId: warehouseMap[tr.from],
        destinationWarehouseId: warehouseMap[tr.to],
        status: tr.status,
        createdById: userMap[Role.INVENTORY_MANAGER],
        approvedById: userMap[Role.SUPERVISOR],
        notes: `Inter-warehouse transfer of ${tr.sku}`
      },
      create: {
        transferNumber: tr.num,
        originWarehouseId: warehouseMap[tr.from],
        destinationWarehouseId: warehouseMap[tr.to],
        status: tr.status,
        createdById: userMap[Role.INVENTORY_MANAGER],
        approvedById: userMap[Role.SUPERVISOR],
        notes: `Inter-warehouse transfer of ${tr.sku}`
      }
    });

    const existingTrfItem = await prisma.stockTransferItem.findFirst({
      where: { transferId: createdTrf.id }
    });
    if (!existingTrfItem) {
      await prisma.stockTransferItem.create({
        data: {
          transferId: createdTrf.id,
          materialId: matId,
          quantityRequested: tr.qty,
          quantityShipped: tr.status !== "REQUESTED" ? tr.qty : 0,
          quantityReceived: tr.status === "RECEIVED" ? tr.qty : 0,
          originLocationId: locationMap["RAW-A01"],
          destinationLocationId: locationMap["ASM-BAY1"]
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Seed Packing Material Configurations & Sample Packing Records
  // ---------------------------------------------------------------------------
  console.log("\n📦 Seeding Packing Material Configurations & Packing Records...");
  const paxTypes = await prisma.paxType.findMany();
  for (const pt of paxTypes) {
    const existingConfigs = await prisma.packingMaterialConfig.count({ where: { paxTypeId: pt.id } });
    if (existingConfigs === 0) {
      await prisma.packingMaterialConfig.createMany({
        data: [
          { paxTypeId: pt.id, name: "Fast Battery Charger (54.6V 5A)", quantity: 1, isRequired: true, notes: "Smart CC/CV charger" },
          { paxTypeId: pt.id, name: "AC Power Charging Cable (1.5m)", quantity: 1, isRequired: true, notes: "3-pin Indian standard" },
          { paxTypeId: pt.id, name: "User Instruction & Safety Manual", quantity: 1, isRequired: true, notes: "Official manual v2.4" },
          { paxTypeId: pt.id, name: "Warranty Card & Registration Certificate", quantity: 1, isRequired: true, notes: "Pre-printed serial" },
          { paxTypeId: pt.id, name: "Chassis Mounting Bracket & Screw Kit", quantity: 1, isRequired: true, notes: "M6 Hex Bolt Set" },
          { paxTypeId: pt.id, name: "Auxiliary CAN/RS485 Communication Cable", quantity: 1, isRequired: false, notes: "For telemetry integration" },
          { paxTypeId: pt.id, name: "Protective EPE Cushion Foam Set (Top/Bottom)", quantity: 2, isRequired: true, notes: "Shock-absorbing custom molded" },
          { paxTypeId: pt.id, name: "Heavy-Duty UN3480 Corrugated Outer Box", quantity: 1, isRequired: true, notes: "Lithium-ion hazard labeled" }
        ]
      });
    }
  }
  console.log("  ✓ Packing Material Configurations seeded for all Pax Types.");

  // Seed sample PackingRecords for READY_FOR_SALE packs
  const readyPacks = await prisma.paxPack.findMany({
    where: { status: "READY_FOR_SALE" }
  });
  let pkSeq = 1;
  for (const rp of readyPacks) {
    const existingPr = await prisma.packingRecord.findUnique({ where: { paxSerial: rp.paxSerial } });
    if (!existingPr) {
      await prisma.packingRecord.create({
        data: {
          packingNumber: `PK-2026-${String(pkSeq).padStart(6, '0')}`,
          paxSerial: rp.paxSerial,
          paxTypeId: rp.paxTypeId,
          operatorId: userMap[Role.PACKING_OPERATOR],
          stationId: stationMap["STN-ASM-01"],
          status: "TRANSFERRED_TO_FINISHED_GOODS",
          stickerNumber: `STK-2026-${String(pkSeq).padStart(6, '0')}`,
          stickerGeneratedAt: new Date(Date.now() - 3600000),
          stickerPrintedAt: new Date(Date.now() - 3600000),
          qrData: `KYRA-ZAM|${rp.paxSerial}|PK-2026-${String(pkSeq).padStart(6, '0')}`,
          boxCondition: "EXCELLENT",
          boxSealed: true,
          destinationWarehouseId: warehouseMap["WH-FG"],
          destinationLocationId: locationMap["FG-STG01"],
          transferredAt: new Date()
        }
      });
      pkSeq++;
    }
  }
  console.log("  ✓ Finished Goods Packing Records seeded.");

  // ---------------------------------------------------------------------------
  // Notifications & Audit Logs for Live Feed
  // ---------------------------------------------------------------------------
  const notificationsData = [
    { role: Role.SALES_EXECUTIVE, msg: "New Quotation QT-000101 accepted by ElectroRide Mobility", channel: "IN_APP" },
    { role: Role.ACCOUNTANT, msg: "Payment PAY-000101 of ₹14,75,000 verified for ElectroRide SO-000101", channel: "IN_APP" },
    { role: Role.SUPERVISOR, msg: "Production Requirement PRD-000102 released to Assembly Bay 1", channel: "IN_APP" },
    { role: Role.QC, msg: "Quality Inspection QC-000106 logged Defect DEF-000101 (Cell Imbalance)", channel: "IN_APP" },
    { role: Role.INVENTORY_MANAGER, msg: "Goods Receipt GRN-000101 (500 Lithium Cells) stocked in RAW-A01", channel: "IN_APP" },
    { role: Role.PURCHASE_MANAGER, msg: "Purchase Order PO-000101 approved and sent to Apex Lithium", channel: "IN_APP" }
  ];

  for (const n of notificationsData) {
    await prisma.notification.create({
      data: {
        role: n.role,
        message: n.msg,
        channel: n.channel,
        status: "DELIVERED"
      }
    });
  }

  console.log("\n================================================================================");
  console.log("🎉 COMPLETE ENTERPRISE DEMO SEEDING COMPLETED SUCCESSFULLY!");
  console.log("================================================================================");
  console.log("📊 Summary of Live Enterprise Data Seeded:");
  console.log("  • Users / Active RBAC Roles:      12 Accounts (All Passwords Intact)");
  console.log("  • Material Catalog Items:          33 Industrial SKUs (QTZ / NQZ)");
  console.log("  • Warehouses & Locations:          4 Warehouses & 12 Specialized Bays");
  console.log("  • Vendors & Suppliers:             8 High-Volume Industrial Suppliers");
  console.log("  • CRM Customers:                  10 Realistic B2B / B2C Customers");
  console.log("  • CRM Leads & Activities:         10 Leads & 10 Scheduled Activities");
  console.log("  • Sales Quotations & SOs:         10 Quotations & 10 Active Sales Orders");
  console.log("  • Procurement (PR / PO / GRN):    10 PRs, 10 POs & 10 Goods Receipts");
  console.log("  • Cell Inwards & Cells:           10 Batches & 120 Serialized Tested Cells");
  console.log("  • Production (Reqs / Plans / WO): 10 PRDs, 10 Plans & 10 Work Orders");
  console.log("  • QA & Defects:                   10 Inspections, 30 Checks & 10 Defects");
  console.log("  • Logistics & Dispatch:           10 Dispatch Orders & 10 Shipments");
  console.log("  • Invoicing & Finance:            10 Invoices, 10 Verified Payments & 10 Warranties");
  console.log("  • RMA Service & Scrap:            10 Service Batteries & 10 Scrap Entries");
  console.log("================================================================================\n");
}
