import { prisma } from "../prisma";

async function main() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename NOT IN ('_prisma_migrations');
  `;
  console.log("Total tables found:", tables.length);
  console.log("Tables:", tables.map((t: any) => t.tablename).sort());

  // Count records in some sample tables
  const counts = {
    users: await prisma.user.count(),
    quotations: await prisma.quotation.count(),
    salesOrders: await prisma.salesOrder.count(),
    invoices: await prisma.invoice.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    purchaseRequests: await prisma.purchaseRequest.count(),
    products: await prisma.product.count(),
    materials: await prisma.material.count(),
    brands: await prisma.brand.count(),
  };
  console.log("Current Counts:", counts);

  await prisma.$disconnect();
}

main().catch(console.error);
