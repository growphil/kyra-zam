import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

describe("Manufacturer Part Number & Cross-Brand Duplicate Search Tests", () => {
  const testPartNo = "TEST-BMS-999";
  const testMpn = "OEM-BMS-MK2";
  let brandX: any;
  let brandY: any;

  before(async () => {
    // Clean any remnants
    await prisma.product.deleteMany({
      where: {
        OR: [
          { partNumber: testPartNo },
          { manufacturerPartNumber: testMpn }
        ]
      }
    });

    // Create 2 distinct test brands
    brandX = await prisma.brand.upsert({
      where: { name: "TEST_BRAND_X" },
      update: { country: "Japan", website: "https://brand-x.jp" },
      create: { name: "TEST_BRAND_X", code: "TBX", nextSequence: 1, country: "Japan", website: "https://brand-x.jp" }
    });

    brandY = await prisma.brand.upsert({
      where: { name: "TEST_BRAND_Y" },
      update: { country: "Germany", website: "https://brand-y.de" },
      create: { name: "TEST_BRAND_Y", code: "TBY", nextSequence: 1, country: "Germany", website: "https://brand-y.de" }
    });
  });

  after(async () => {
    await prisma.product.deleteMany({
      where: {
        OR: [
          { partNumber: testPartNo },
          { manufacturerPartNumber: testMpn }
        ]
      }
    });
    await prisma.$disconnect();
  });

  it("1. Product stores manufacturerPartNumber alongside internal partNumber", async () => {
    const prodX = await prisma.product.create({
      data: {
        name: "Test Balancer X",
        partNumber: testPartNo,
        manufacturerPartNumber: testMpn,
        brand: brandX.name,
        brandId: brandX.id,
        category: "BMS",
        uin: `KYR-001-TBX-001-${testPartNo}`,
        unit: "PCS"
      }
    });

    assert.equal(prodX.manufacturerPartNumber, testMpn);
    assert.equal(prodX.partNumber, testPartNo);
    assert.equal(prodX.brandId, brandX.id);
  });

  it("2. Cross-brand discovery locates product under Brand X when searching under Brand Y", async () => {
    // Search with manufacturerPartNumber for Brand Y
    const crossMatches = await prisma.product.findMany({
      where: {
        AND: [
          { brandId: { not: brandY.id } },
          {
            OR: [
              { partNumber: testPartNo },
              { manufacturerPartNumber: { equals: testMpn, mode: "insensitive" } }
            ]
          }
        ]
      }
    });

    assert.equal(crossMatches.length, 1);
    assert.equal(crossMatches[0].brand, brandX.name);
    assert.equal(crossMatches[0].manufacturerPartNumber, testMpn);
  });

  it("3. Brand stores country and website fields accurately", async () => {
    const fetchedX = await prisma.brand.findUnique({ where: { id: brandX.id } });
    assert.equal(fetchedX?.country, "Japan");
    assert.equal(fetchedX?.website, "https://brand-x.jp");
  });
});
