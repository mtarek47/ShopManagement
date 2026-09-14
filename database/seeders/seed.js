'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../backend/.env' });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed with full grocery items...\n');

  // ── Master Super Admin (Root Master Account) ────────────────────────────────
  const superAdminHash = await bcrypt.hash('superadmin123', 12);
  const masterSuperAdmin = await prisma.user.upsert({
    where: { phone: '01999999999' },
    update: { role: 'SUPER_ADMIN', isActive: true },
    create: {
      name: 'Master Super Admin',
      phone: '01999999999',
      passwordHash: superAdminHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  console.log(`👑 Master Super Admin: ${masterSuperAdmin.name} (${masterSuperAdmin.role}) — 01999999999 / superadmin123`);

  // ── Admin User ──────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { phone: '01700000000' },
    update: { role: 'ADMIN', isActive: true },
    create: {
      name: 'Admin',
      phone: '01700000000',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log(`✅ User: ${admin.name} (${admin.role}) — 01700000000 / admin123`);

  // ── Categories ──────────────────────────────────────────────────────────────
  const categoryNames = [
    'Vegetables & Fresh (কাঁচা বাজার)',
    'Rice, Dal & Grains (চাল ও ডাল)',
    'Spices & Oil (তেল ও মশলা)',
    'Dairy & Eggs (দুধ ও ডিম)',
    'Bakery & Snacks (বেকারি ও স্ন্যাক্স)',
    'Packaged Foods (প্যাকেটজাত খাবার)',
    'Beverages (পানীয় ও জুস)',
    'Grocery (মুদি ও নিত্যপণ্য)',
    'Snacks (স্ন্যাক্স ও বিস্কুট)',
    'Pharmacy (ফার্মেসি ও ওষুধ)',
    'Electronics (ইলেকট্রনিক্স)',
  ];

  const categories = {};
  for (const name of categoryNames) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, isActive: true },
    });
    categories[name] = cat;
  }

  // ── Brands ──────────────────────────────────────────────────────────────────
  const brandNames = ['Fresh Loose (খোলা পণ্য)', 'Pran', 'Aarong', 'Square', 'Teer'];
  const brands = {};
  for (const name of brandNames) {
    const brand = await prisma.brand.upsert({
      where: { name },
      update: {},
      create: { name, isActive: true },
    });
    brands[name] = brand;
  }

  // ── Products (Both Barcoded & Non-Barcoded Loose Grocery) ───────────────────
  const productSeed = [
    // Non-Barcoded Fresh Loose Grocery (Weight / kg / hali / pcs)
    {
      name: 'Red Potato (গোল আলু)',
      sku: 'VEG-POTATO',
      barcode: null,
      categoryId: categories['Vegetables & Fresh (কাঁচা বাজার)'].id,
      brandId: brands['Fresh Loose (খোলা পণ্য)'].id,
      costPrice: 30.00,
      salePrice: 40.00,
      unit: 'kg',
      currentStock: 300,
      lowStockThreshold: 20,
    },
    {
      name: 'Local Onion (দেশি পেঁয়াজ)',
      sku: 'VEG-ONION',
      barcode: null,
      categoryId: categories['Vegetables & Fresh (কাঁচা বাজার)'].id,
      brandId: brands['Fresh Loose (খোলা পণ্য)'].id,
      costPrice: 75.00,
      salePrice: 90.00,
      unit: 'kg',
      currentStock: 250,
      lowStockThreshold: 25,
    },
    {
      name: 'Garlic (দেশি রসুন)',
      sku: 'VEG-GARLIC',
      barcode: null,
      categoryId: categories['Vegetables & Fresh (কাঁচা বাজার)'].id,
      brandId: brands['Fresh Loose (খোলা পণ্য)'].id,
      costPrice: 160.00,
      salePrice: 190.00,
      unit: 'kg',
      currentStock: 80,
      lowStockThreshold: 10,
    },
    {
      name: 'Ginger (আদা)',
      sku: 'VEG-GINGER',
      barcode: null,
      categoryId: categories['Vegetables & Fresh (কাঁচা বাজার)'].id,
      brandId: brands['Fresh Loose (খোলা পণ্য)'].id,
      costPrice: 180.00,
      salePrice: 220.00,
      unit: 'kg',
      currentStock: 60,
      lowStockThreshold: 10,
    },
    {
      name: 'Green Chili (কাঁচা মরিচ)',
      sku: 'VEG-CHILI',
      barcode: null,
      categoryId: categories['Vegetables & Fresh (কাঁচা বাজার)'].id,
      brandId: brands['Fresh Loose (খোলা পণ্য)'].id,
      costPrice: 120.00,
      salePrice: 160.00,
      unit: 'kg',
      currentStock: 40,
      lowStockThreshold: 5,
    },
    {
      name: 'Fresh Tomato (টমেটো)',
      sku: 'VEG-TOMATO',
      barcode: null,
      categoryId: categories['Vegetables & Fresh (কাঁচা বাজার)'].id,
      brandId: brands['Fresh Loose (খোলা পণ্য)'].id,
      costPrice: 45.00,
      salePrice: 60.00,
      unit: 'kg',
      currentStock: 100,
      lowStockThreshold: 15,
    },
    {
      name: 'Farm Fresh Eggs (ডিম)',
      sku: 'DAIRY-EGG',
      barcode: null,
      categoryId: categories['Dairy & Eggs (দুধ ও ডিম)'].id,
      brandId: brands['Fresh Loose (খোলা পণ্য)'].id,
      costPrice: 42.00,
      salePrice: 50.00,
      unit: 'hali',
      currentStock: 400,
      lowStockThreshold: 40,
    },
    {
      name: 'Fresh Cow Milk (গরুর দুধ)',
      sku: 'DAIRY-MILK',
      barcode: null,
      categoryId: categories['Dairy & Eggs (দুধ ও ডিম)'].id,
      brandId: brands['Fresh Loose (খোলা পণ্য)'].id,
      costPrice: 65.00,
      salePrice: 80.00,
      unit: 'litre',
      currentStock: 60,
      lowStockThreshold: 10,
    },
    {
      name: 'Miniket Premium Rice (মিনিকেট চাল)',
      sku: 'GRAIN-MINIKET',
      barcode: null,
      categoryId: categories['Rice, Dal & Grains (চাল ও ডাল)'].id,
      brandId: brands['Fresh Loose (খোলা পণ্য)'].id,
      costPrice: 65.00,
      salePrice: 74.00,
      unit: 'kg',
      currentStock: 500,
      lowStockThreshold: 50,
    },
    {
      name: 'Nazirshail Rice (নাজিরশাইল চাল)',
      sku: 'GRAIN-NAZIR',
      barcode: null,
      categoryId: categories['Rice, Dal & Grains (চাল ও ডাল)'].id,
      brandId: brands['Fresh Loose (খোলা পণ্য)'].id,
      costPrice: 75.00,
      salePrice: 86.00,
      unit: 'kg',
      currentStock: 400,
      lowStockThreshold: 40,
    },
    {
      name: 'Masoor Dal (দেশি মসুর ডাল)',
      sku: 'GRAIN-DAL',
      barcode: null,
      categoryId: categories['Rice, Dal & Grains (চাল ও ডাল)'].id,
      brandId: brands['Fresh Loose (খোলা পণ্য)'].id,
      costPrice: 120.00,
      salePrice: 140.00,
      unit: 'kg',
      currentStock: 150,
      lowStockThreshold: 20,
    },
    {
      name: 'Loose White Sugar (খোলা চিনি)',
      sku: 'GRAIN-SUGAR',
      barcode: null,
      categoryId: categories['Rice, Dal & Grains (চাল ও ডাল)'].id,
      brandId: brands['Fresh Loose (খোলা পণ্য)'].id,
      costPrice: 125.00,
      salePrice: 135.00,
      unit: 'kg',
      currentStock: 200,
      lowStockThreshold: 25,
    },
    // Barcoded Packaged Goods
    {
      name: 'Teer Fortified Soybean Oil 1L',
      sku: 'OIL-TEER-1L',
      barcode: '8901234561001',
      categoryId: categories['Spices & Oil (তেল ও মশলা)'].id,
      brandId: brands['Teer'].id,
      costPrice: 175.00,
      salePrice: 185.00,
      unit: 'bottle',
      currentStock: 120,
      lowStockThreshold: 20,
    },
    {
      name: 'Aarong Liquid Milk 1L',
      sku: 'DAIRY-AARONG-1L',
      barcode: '8901234561002',
      categoryId: categories['Dairy & Eggs (দুধ ও ডিম)'].id,
      brandId: brands['Aarong'].id,
      costPrice: 85.00,
      salePrice: 95.00,
      unit: 'pack',
      currentStock: 80,
      lowStockThreshold: 15,
    },
    {
      name: 'Pran Frooto Mango Drink 250ml',
      sku: 'BEV-FROOTO-250',
      barcode: '8901234561003',
      categoryId: categories['Packaged & Beverage (প্যাকেটজাত)'].id,
      brandId: brands['Pran'].id,
      costPrice: 22.00,
      salePrice: 28.00,
      unit: 'bottle',
      currentStock: 150,
      lowStockThreshold: 30,
    },
  ];

  for (const p of productSeed) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        costPrice: p.costPrice,
        salePrice: p.salePrice,
        unit: p.unit,
        currentStock: p.currentStock,
        categoryId: p.categoryId,
        brandId: p.brandId,
      },
      create: { ...p, isActive: true },
    });
    console.log(`✅ Product: ${product.name} [${product.unit}] — ৳${product.salePrice}`);
  }

  // ── Walk-in Customer ─────────────────────────────────────────────────────────
  await prisma.customer.upsert({
    where: { phone: '00000000000' },
    update: {},
    create: {
      name: 'Walk-in Customer',
      phone: '00000000000',
      loyaltyPoints: 10,
    },
  });

  console.log('\n✨ Database grocery seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
