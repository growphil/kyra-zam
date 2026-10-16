import { PrismaClient, Role } from "../generated/client";

const prisma = new PrismaClient();

export const FACTORY_DEMO_CATEGORIES = [
  "BATTERY CELLS",
  "BUSBARS",
  "BMS",
  "CONNECTORS",
  "INSULATION MATERIALS",
  "WIRES & CABLES",
  "FUSES & PROTECTION",
  "ENCLOSURES",
  "FASTENERS",
  "THERMAL MANAGEMENT",
  "LABELS & CONSUMABLES"
];

export const FACTORY_DEMO_MATERIALS = [
  // CATEGORY 1 — Battery Cells (QTZ)
  {
    category: "BATTERY CELLS",
    name: "Lithium-Ion Cell 3.7V 50Ah",
    materialCode: "MAT-CELL-001",
    sku: "CELL-18650-50AH",
    description: "Rechargeable lithium-ion battery cell for battery pack assembly (3.7V Nominal, 50Ah Capacity)",
    unit: "PCS",
    baseCost: 450,
    materialType: "QTZ",
    isActive: true
  },
  {
    category: "BATTERY CELLS",
    name: "Lithium-Ion Cell 3.7V 60Ah",
    materialCode: "MAT-CELL-002",
    sku: "CELL-21700-60AH",
    description: "High-capacity lithium-ion cell used in medium-duty battery packs (3.7V Nominal, 60Ah Capacity)",
    unit: "PCS",
    baseCost: 520,
    materialType: "QTZ",
    isActive: true
  },
  {
    category: "BATTERY CELLS",
    name: "Lithium-Ion Cell 3.7V 100Ah",
    materialCode: "MAT-CELL-003",
    sku: "CELL-32140-100AH",
    description: "High-capacity cell designed for large battery pack applications (3.7V Nominal, 100Ah Capacity)",
    unit: "PCS",
    baseCost: 850,
    materialType: "QTZ",
    isActive: true
  },

  // CATEGORY 2 — Busbars (QTZ)
  {
    category: "BUSBARS",
    name: "Copper Busbar 20mm",
    materialCode: "MAT-BUS-001",
    sku: "BUS-CU-20MM",
    description: "Copper electrical conductor for battery cell interconnection (Copper, 20mm Width)",
    unit: "PCS",
    baseCost: 85,
    materialType: "QTZ",
    isActive: true
  },
  {
    category: "BUSBARS",
    name: "Copper Busbar 25mm",
    materialCode: "MAT-BUS-002",
    sku: "BUS-CU-25MM",
    description: "High-current copper busbar used for battery module connections (Copper, 25mm Width)",
    unit: "PCS",
    baseCost: 110,
    materialType: "QTZ",
    isActive: true
  },
  {
    category: "BUSBARS",
    name: "Nickel-Plated Busbar 30mm",
    materialCode: "MAT-BUS-003",
    sku: "BUS-NI-30MM",
    description: "Corrosion-resistant busbar for high-current battery connections (Nickel Plated Copper, 30mm)",
    unit: "PCS",
    baseCost: 145,
    materialType: "QTZ",
    isActive: true
  },

  // CATEGORY 3 — BMS (QTZ)
  {
    category: "BMS",
    name: "4S Battery Management System",
    materialCode: "MAT-BMS-001",
    sku: "BMS-4S-40A",
    description: "Battery protection and monitoring controller for 4-cell series packs (4S, 40A Continuous)",
    unit: "PCS",
    baseCost: 380,
    materialType: "QTZ",
    isActive: true
  },
  {
    category: "BMS",
    name: "8S Battery Management System",
    materialCode: "MAT-BMS-002",
    sku: "BMS-8S-60A",
    description: "Multi-cell protection controller for medium battery packs (8S, 60A Continuous)",
    unit: "PCS",
    baseCost: 620,
    materialType: "QTZ",
    isActive: true
  },
  {
    category: "BMS",
    name: "16S Battery Management System",
    materialCode: "MAT-BMS-003",
    sku: "BMS-16S-100A",
    description: "Advanced BMS for high-capacity battery pack applications (16S, 100A Continuous)",
    unit: "PCS",
    baseCost: 1250,
    materialType: "QTZ",
    isActive: true
  },

  // CATEGORY 4 — Connectors (QTZ)
  {
    category: "CONNECTORS",
    name: "2-Pin Power Connector",
    materialCode: "MAT-CON-001",
    sku: "CON-PWR-2PIN",
    description: "High-current connector for battery power connections (2-Pin, High Current)",
    unit: "PCS",
    baseCost: 35,
    materialType: "QTZ",
    isActive: true
  },
  {
    category: "CONNECTORS",
    name: "4-Pin Signal Connector",
    materialCode: "MAT-CON-002",
    sku: "CON-SIG-4PIN",
    description: "Signal connector used for battery monitoring and communication (4-Pin, Signal)",
    unit: "PCS",
    baseCost: 22,
    materialType: "QTZ",
    isActive: true
  },
  {
    category: "CONNECTORS",
    name: "6-Pin BMS Connector",
    materialCode: "MAT-CON-003",
    sku: "CON-BMS-6PIN",
    description: "Multi-pin connector for BMS wiring harness connections (6-Pin, BMS Compatible)",
    unit: "PCS",
    baseCost: 30,
    materialType: "QTZ",
    isActive: true
  },

  // CATEGORY 5 — Insulation Materials (NQZ)
  {
    category: "INSULATION MATERIALS",
    name: "PET Insulation Sheet",
    materialCode: "MAT-INS-001",
    sku: "INS-PET-SHEET",
    description: "Electrical insulation sheet used between battery components (PET, 0.25mm Thickness)",
    unit: "SHEET",
    baseCost: 18,
    materialType: "NQZ",
    isActive: true
  },
  {
    category: "INSULATION MATERIALS",
    name: "Fish Paper Insulation",
    materialCode: "MAT-INS-002",
    sku: "INS-FP-SHEET",
    description: "High-temperature electrical insulation material for cell protection (0.3mm Electrical Grade)",
    unit: "SHEET",
    baseCost: 15,
    materialType: "NQZ",
    isActive: true
  },
  {
    category: "INSULATION MATERIALS",
    name: "Kapton Insulation Tape",
    materialCode: "MAT-INS-003",
    sku: "INS-KAP-TAPE",
    description: "Heat-resistant adhesive insulation tape for battery assembly (20mm Width, High Temperature)",
    unit: "ROLL",
    baseCost: 125,
    materialType: "NQZ",
    isActive: true
  },

  // CATEGORY 6 — Wires & Cables (NQZ)
  {
    category: "WIRES & CABLES",
    name: "6 AWG Battery Cable",
    materialCode: "MAT-WIRE-001",
    sku: "WIRE-6AWG-RED",
    description: "Heavy-duty cable for high-current battery connections (6 AWG, Red, Flexible)",
    unit: "METER",
    baseCost: 180,
    materialType: "NQZ",
    isActive: true
  },
  {
    category: "WIRES & CABLES",
    name: "8 AWG Battery Cable",
    materialCode: "MAT-WIRE-002",
    sku: "WIRE-8AWG-BLK",
    description: "Flexible power cable for battery module wiring (8 AWG, Black, Flexible)",
    unit: "METER",
    baseCost: 125,
    materialType: "NQZ",
    isActive: true
  },
  {
    category: "WIRES & CABLES",
    name: "12 AWG Signal Wire",
    materialCode: "MAT-WIRE-003",
    sku: "WIRE-12AWG-SIG",
    description: "Insulated wire for low-current control and signal connections (12 AWG, Multi-Color)",
    unit: "METER",
    baseCost: 55,
    materialType: "NQZ",
    isActive: true
  },

  // CATEGORY 7 — Fuses & Protection (QTZ)
  {
    category: "FUSES & PROTECTION",
    name: "40A Blade Fuse",
    materialCode: "MAT-FUSE-001",
    sku: "FUSE-40A-BLD",
    description: "Over-current protection fuse for low-to-medium power circuits (40A Blade Type)",
    unit: "PCS",
    baseCost: 18,
    materialType: "QTZ",
    isActive: true
  },
  {
    category: "FUSES & PROTECTION",
    name: "60A Cartridge Fuse",
    materialCode: "MAT-FUSE-002",
    sku: "FUSE-60A-CAR",
    description: "Cartridge fuse for battery pack over-current protection (60A Cartridge Type)",
    unit: "PCS",
    baseCost: 45,
    materialType: "QTZ",
    isActive: true
  },
  {
    category: "FUSES & PROTECTION",
    name: "100A ANL Fuse",
    materialCode: "MAT-FUSE-003",
    sku: "FUSE-100A-ANL",
    description: "High-current protection fuse for large battery systems (100A ANL Type)",
    unit: "PCS",
    baseCost: 95,
    materialType: "QTZ",
    isActive: true
  },

  // CATEGORY 8 — Enclosures (QTZ)
  {
    category: "ENCLOSURES",
    name: "ABS Battery Enclosure Small",
    materialCode: "MAT-ENC-001",
    sku: "ENC-ABS-SM",
    description: "Compact ABS enclosure for small battery modules (ABS Plastic, Small)",
    unit: "PCS",
    baseCost: 450,
    materialType: "QTZ",
    isActive: true
  },
  {
    category: "ENCLOSURES",
    name: "ABS Battery Enclosure Medium",
    materialCode: "MAT-ENC-002",
    sku: "ENC-ABS-MD",
    description: "Medium-sized protective enclosure for battery assemblies (ABS Plastic, Medium)",
    unit: "PCS",
    baseCost: 680,
    materialType: "QTZ",
    isActive: true
  },
  {
    category: "ENCLOSURES",
    name: "Aluminium Battery Enclosure Large",
    materialCode: "MAT-ENC-003",
    sku: "ENC-AL-LG",
    description: "Heavy-duty aluminium enclosure for large battery packs (Aluminium, Large)",
    unit: "PCS",
    baseCost: 1850,
    materialType: "QTZ",
    isActive: true
  },

  // CATEGORY 9 — Fasteners (QTZ)
  {
    category: "FASTENERS",
    name: "M4 Stainless Steel Bolt",
    materialCode: "MAT-FAST-001",
    sku: "FAST-M4-BOLT",
    description: "Stainless steel bolt used for battery enclosure assembly (M4 × 10mm, SS304)",
    unit: "PCS",
    baseCost: 3,
    materialType: "QTZ",
    isActive: true
  },
  {
    category: "FASTENERS",
    name: "M5 Stainless Steel Bolt",
    materialCode: "MAT-FAST-002",
    sku: "FAST-M5-BOLT",
    description: "Stainless steel fastening component for mechanical assembly (M5 × 15mm, SS304)",
    unit: "PCS",
    baseCost: 4,
    materialType: "QTZ",
    isActive: true
  },
  {
    category: "FASTENERS",
    name: "M6 Stainless Steel Nut",
    materialCode: "MAT-FAST-003",
    sku: "FAST-M6-NUT",
    description: "Stainless steel nut used with battery enclosure mounting hardware (M6, SS304)",
    unit: "PCS",
    baseCost: 3,
    materialType: "QTZ",
    isActive: true
  },

  // CATEGORY 10 — Thermal Management (NQZ)
  {
    category: "THERMAL MANAGEMENT",
    name: "Thermal Pad 1mm",
    materialCode: "MAT-THERM-001",
    sku: "THERM-PAD-1MM",
    description: "Thermal interface pad for heat transfer between components (1mm Thickness, Thermal Conductive)",
    unit: "SHEET",
    baseCost: 85,
    materialType: "NQZ",
    isActive: true
  },
  {
    category: "THERMAL MANAGEMENT",
    name: "Thermal Pad 2mm",
    materialCode: "MAT-THERM-002",
    sku: "THERM-PAD-2MM",
    description: "High-compression thermal interface material for battery assemblies (2mm Thickness)",
    unit: "SHEET",
    baseCost: 120,
    materialType: "NQZ",
    isActive: true
  },
  {
    category: "THERMAL MANAGEMENT",
    name: "Thermal Paste 5W/mK",
    materialCode: "MAT-THERM-003",
    sku: "THERM-PASTE-5W",
    description: "Thermal compound used to improve heat transfer from components (5W/mK Thermal Conductivity)",
    unit: "TUBE",
    baseCost: 175,
    materialType: "NQZ",
    isActive: true
  },

  // CATEGORY 11 — Labels & Consumables (NQZ)
  {
    category: "LABELS & CONSUMABLES",
    name: "Battery Warning Label",
    materialCode: "MAT-LBL-001",
    sku: "LBL-BATT-WARN",
    description: "Safety warning label applied to finished battery packs (Adhesive, Weather Resistant)",
    unit: "PCS",
    baseCost: 2,
    materialType: "NQZ",
    isActive: true
  },
  {
    category: "LABELS & CONSUMABLES",
    name: "QR Identification Label",
    materialCode: "MAT-LBL-002",
    sku: "LBL-QR-ID",
    description: "QR-based identification label for tracking battery assemblies (Thermal Transfer, QR Compatible)",
    unit: "PCS",
    baseCost: 3,
    materialType: "NQZ",
    isActive: true
  },
  {
    category: "LABELS & CONSUMABLES",
    name: "Production Date Label",
    materialCode: "MAT-LBL-003",
    sku: "LBL-DATE-PROD",
    description: "Production date and batch identification label (Adhesive, Thermal Printable)",
    unit: "PCS",
    baseCost: 2,
    materialType: "NQZ",
    isActive: true
  }
];

export async function seedFactoryDemoMaterials() {
  console.log("🏭 Seeding Factory Settings Material Part Number Catalog (Demo Data with QTZ/NQZ)...");

  // Find Admin/SuperAdmin user for audit logging
  const adminUser = await prisma.user.findFirst({
    where: {
      roles: {
        hasSome: [Role.SUPERADMIN, Role.ADMIN]
      }
    }
  });

  // 1. Seed / Ensure all 11 Categories
  let categoriesCreated = 0;
  let categoriesReused = 0;

  for (const catName of FACTORY_DEMO_CATEGORIES) {
    const existing = await prisma.materialCategory.findUnique({
      where: { name: catName }
    });

    if (!existing) {
      const created = await prisma.materialCategory.create({
        data: { name: catName }
      });
      categoriesCreated++;
      console.log(`  ✓ Category created: ${created.name}`);

      if (adminUser) {
        await prisma.auditLog.create({
          data: {
            entityType: "material_category",
            entityId: created.id,
            actorId: adminUser.id,
            action: "FACTORY_MATERIAL_CATEGORY_CREATED",
            metadata: { name: created.name, isDemoData: true }
          }
        });
      }
    } else {
      categoriesReused++;
      console.log(`  ↻ Category reused: ${existing.name}`);
    }
  }

  // 2. Seed / Upsert all 33 Materials with Tracking Type (QTZ / NQZ)
  let materialsCreated = 0;
  let materialsUpdated = 0;

  for (const mat of FACTORY_DEMO_MATERIALS) {
    const existing = await prisma.material.findUnique({
      where: { sku: mat.sku }
    });

    if (!existing) {
      const created = await prisma.material.create({
        data: {
          name: mat.name,
          materialCode: mat.materialCode,
          sku: mat.sku,
          category: mat.category,
          unit: mat.unit,
          description: mat.description,
          unitPrice: mat.baseCost,
          totalValue: 0,
          quantity: 0,
          minStock: 5,
          materialType: mat.materialType,
          isActive: mat.isActive,
          isPriceVerified: true
        }
      });
      materialsCreated++;
      console.log(`  ✓ Material created: [${created.materialCode}] [${created.materialType}] ${created.sku} — ${created.name} (₹${mat.baseCost})`);

      if (adminUser) {
        await prisma.auditLog.create({
          data: {
            entityType: "material_mapping",
            entityId: created.id,
            actorId: adminUser.id,
            action: "FACTORY_MATERIAL_MAPPING_CREATED",
            metadata: {
              name: created.name,
              materialCode: created.materialCode,
              sku: created.sku,
              category: created.category,
              materialType: created.materialType,
              unitPrice: mat.baseCost,
              isDemoData: true
            }
          }
        });
      }
    } else {
      // Update details to ensure demo data consistency while preserving current inventory quantities
      await prisma.material.update({
        where: { id: existing.id },
        data: {
          name: mat.name,
          materialCode: mat.materialCode,
          category: mat.category,
          unit: mat.unit,
          description: mat.description,
          unitPrice: mat.baseCost,
          materialType: mat.materialType,
          isActive: mat.isActive
        }
      });
      materialsUpdated++;
      console.log(`  ↻ Material updated/reused: [${mat.materialCode}] [${mat.materialType}] ${mat.sku} — ${mat.name}`);
    }
  }

  // 3. Verification Summary
  const totalCategoriesInDb = await prisma.materialCategory.count();
  const totalMaterialsInDb = await prisma.material.count();
  const qtzCount = await prisma.material.count({ where: { materialType: "QTZ" } });
  const nqzCount = await prisma.material.count({ where: { materialType: "NQZ" } });

  console.log("\n=======================================================");
  console.log("  FACTORY DEMO DATA SEEDING COMPLETE ✨");
  console.log("=======================================================");
  console.log(`Categories Created: ${categoriesCreated} | Reused: ${categoriesReused} | Total in DB: ${totalCategoriesInDb}`);
  console.log(`Materials Created:  ${materialsCreated} | Updated/Reused: ${materialsUpdated} | Total in DB: ${totalMaterialsInDb}`);
  console.log(`Tracking Types:     Quantitized (QTZ): ${qtzCount} | Non-Quantitized (NQZ): ${nqzCount}`);
  
  // Verify category distribution
  const distribution = await prisma.material.groupBy({
    by: ["category", "materialType"],
    _count: { id: true }
  });

  console.log("\n📊 Category & Type Distribution:");
  for (const d of distribution) {
    console.log(`  • ${d.category} [${d.materialType}]: ${d._count.id} materials`);
  }

  return {
    categoriesCreated,
    categoriesReused,
    materialsCreated,
    materialsUpdated,
    totalCategoriesInDb,
    totalMaterialsInDb,
    qtzCount,
    nqzCount,
    distribution
  };
}

// Allow direct execution
if (require.main === module) {
  seedFactoryDemoMaterials()
    .catch((err) => {
      console.error("❌ Seeding failed:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
