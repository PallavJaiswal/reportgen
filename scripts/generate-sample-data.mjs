// Regenerates the demo CSVs in public/sample-data/.
// Deliberately includes messy real-world artifacts (duplicate rows, blank
// fields, non-canonical headers) plus a few planted anomalies, so the
// cleaning + anomaly-detection steps have something real to show.
// Run with: node scripts/generate-sample-data.mjs
import { writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "sample-data");
mkdirSync(OUT_DIR, { recursive: true });

// Seeded PRNG (mulberry32) so regeneration is deterministic.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260214);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

const START_DATE = new Date("2025-04-01");
const END_DATE = new Date("2026-06-30");
function eachDay(start, end) {
  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}
const DAYS = eachDay(START_DATE, END_DATE);
const fmtDate = (d) => d.toISOString().slice(0, 10);

const REGIONS = ["North", "South", "East", "West"];
const CHANNELS = ["Online", "Retail", "Wholesale"];

const PRODUCTS = [
  { sku: "WM-101", name: "Trailhead Backpack 28L", category: "Bags", price: 89.0, cost: 38.0 },
  { sku: "WM-102", name: "Trailhead Backpack 45L", category: "Bags", price: 129.0, cost: 55.0 },
  { sku: "WM-140", name: "Alpine Hardshell Jacket", category: "Outerwear", price: 219.0, cost: 96.0 },
  { sku: "WM-141", name: "Alpine Softshell Vest", category: "Outerwear", price: 129.0, cost: 54.0 },
  { sku: "WM-160", name: "Ridge Merino Base Layer", category: "Apparel", price: 59.0, cost: 22.0 },
  { sku: "WM-161", name: "Ridge Merino Beanie", category: "Apparel", price: 24.0, cost: 8.0 },
  { sku: "WM-180", name: "Summit Trekking Poles (Pair)", category: "Gear", price: 74.0, cost: 29.0 },
  { sku: "WM-181", name: "Summit Camp Stove", category: "Gear", price: 64.0, cost: 24.0 },
  { sku: "WM-190", name: "Basecamp 2P Tent", category: "Gear", price: 249.0, cost: 112.0 },
  { sku: "WM-191", name: "Basecamp 4P Tent", category: "Gear", price: 349.0, cost: 158.0 },
  { sku: "WM-210", name: "Voyager Sleeping Bag 20F", category: "Gear", price: 159.0, cost: 68.0 },
  { sku: "WM-215", name: "Voyager Sleeping Pad", category: "Gear", price: 89.0, cost: 34.0 },
  { sku: "WM-230", name: "Trailrunner Trail Shoe", category: "Footwear", price: 119.0, cost: 48.0 },
  { sku: "WM-231", name: "Trailrunner Hiking Boot", category: "Footwear", price: 159.0, cost: 66.0 },
  { sku: "WM-250", name: "Aqua Filter Bottle 750ml", category: "Accessories", price: 39.0, cost: 14.0 },
  { sku: "WM-251", name: "Aqua Hydration Bladder 2L", category: "Accessories", price: 34.0, cost: 12.0 },
  { sku: "WM-270", name: "Compass Nav Watch", category: "Electronics", price: 189.0, cost: 82.0 },
  { sku: "WM-271", name: "Compass Headlamp 400", category: "Electronics", price: 44.0, cost: 16.0 },
];

// Region-relative demand weights so top/bottom performer ranking is meaningful.
const REGION_WEIGHT = { North: 1.15, South: 0.95, East: 0.75, West: 1.1 };
const CHANNEL_WEIGHT = { Online: 1.2, Retail: 0.9, Wholesale: 0.6 };

function isWeekend(d) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function seasonalMultiplier(d) {
  const month = d.getMonth(); // 0-11
  // Nov/Dec holiday bump, Jul/Aug summer gear bump
  if (month === 10 || month === 11) return 1.45;
  if (month === 6 || month === 7) return 1.2;
  if (month === 0) return 0.8; // post-holiday lull
  return 1.0;
}

// --- Sales rows ---------------------------------------------------------
const salesRows = [];
for (const day of DAYS) {
  const weekendMult = isWeekend(day) ? 1.25 : 1.0;
  const season = seasonalMultiplier(day);
  const monthsSinceStart =
    (day.getFullYear() - START_DATE.getFullYear()) * 12 +
    (day.getMonth() - START_DATE.getMonth());
  const growthTrend = 1 + monthsSinceStart * 0.012; // slow organic growth

  for (const region of REGIONS) {
    // Planted anomaly: East region demand collapses for all of Jan 2026
    // (distribution/logistics issue root-cause for drill-down).
    const eastCollapse =
      region === "East" && day.getFullYear() === 2026 && day.getMonth() === 0
        ? 0.35
        : 1.0;

    const baseTransactions = Math.round(
      4 * REGION_WEIGHT[region] * weekendMult * season * growthTrend * eastCollapse
    );

    for (let t = 0; t < baseTransactions; t++) {
      const product = pick(PRODUCTS);
      const channel = pick(CHANNELS);

      let units = Math.max(1, Math.round(int(1, 4) * CHANNEL_WEIGHT[channel]));

      // Planted anomaly: Voyager Sleeping Pad (WM-215) spikes hard for 5 days
      // in November (flash promo) — a real, explainable spike.
      if (
        product.sku === "WM-215" &&
        day.getMonth() === 10 &&
        day.getDate() >= 20 &&
        day.getDate() <= 24
      ) {
        units *= 6;
      }

      // Planted anomaly: unexplained one-day spike for a mid-tier SKU in
      // February — the kind of true statistical outlier anomaly detection
      // should catch without an obvious seasonal excuse.
      if (
        product.sku === "WM-181" &&
        fmtDate(day) === "2026-02-11"
      ) {
        units *= 9;
      }

      const revenue = Math.round(units * product.price * 100) / 100;

      salesRows.push({
        date: fmtDate(day),
        sku: product.sku,
        product: product.name,
        region,
        channel,
        units,
        unitPrice: product.price.toFixed(2),
        revenue: revenue.toFixed(2),
      });
    }
  }
}

// --- Orders rows (aggregated, ~1 order per handful of sales lines) -----
const ordersRows = [];
let orderSeq = 100000;
for (let i = 0; i < salesRows.length; i += int(2, 4)) {
  const slice = salesRows.slice(i, i + int(2, 4));
  if (slice.length === 0) continue;
  const total = slice.reduce((sum, r) => sum + Number(r.revenue), 0);
  const first = slice[0];
  orderSeq += 1;
  ordersRows.push({
    orderId: `ORD-${orderSeq}`,
    orderDate: first.date,
    customerId: `CUST-${int(1000, 9999)}`,
    channel: first.channel,
    region: first.region,
    status: pick(["Fulfilled", "Fulfilled", "Fulfilled", "Fulfilled", "Cancelled", "Refunded"]),
    total: total.toFixed(2),
  });
}

// --- Inventory rows (one row per SKU per warehouse) ---------------------
const WAREHOUSES = ["DC-North", "DC-South", "DC-East", "DC-West"];
const inventoryRows = [];
for (const product of PRODUCTS) {
  for (const warehouse of WAREHOUSES) {
    let onHand = int(20, 400);
    const reorderPoint = int(30, 80);

    // Planted anomaly: Compass Nav Watch is critically under-stocked at
    // DC-East — reorder point breached, feeds a risk/opportunity flag.
    if (product.sku === "WM-270" && warehouse === "DC-East") {
      onHand = int(2, 8);
    }

    inventoryRows.push({
      sku: product.sku,
      productName: product.name,
      warehouse,
      onHand,
      reorderPoint,
      unitCost: product.cost.toFixed(2),
    });
  }
}

// --- Returns rows ---------------------------------------------------------
const REASONS = ["Defective", "Wrong item", "No longer needed", "Sizing issue", "Damaged in transit"];
const returnsRows = [];
let returnSeq = 500;
for (const order of ordersRows) {
  if (order.status !== "Refunded" && rand() > 0.06) continue;
  const product = pick(PRODUCTS);
  returnSeq += 1;

  // Planted anomaly: Ridge Merino Base Layer gets a defect-driven return
  // spike in March 2026 (quality issue root-cause).
  const isMarchDefectWave =
    product.sku === "WM-160" && order.orderDate.startsWith("2026-03");

  returnsRows.push({
    returnId: `RET-${returnSeq}`,
    orderId: order.orderId,
    sku: product.sku,
    returnDate: order.orderDate,
    reason: isMarchDefectWave ? "Defective" : pick(REASONS),
    units: int(1, 2),
    refund: (int(20, 200)).toFixed(2),
  });

  if (isMarchDefectWave) {
    // A few extra defect returns that week to make the spike detectable.
    for (let k = 0; k < 3; k++) {
      returnSeq += 1;
      returnsRows.push({
        returnId: `RET-${returnSeq}`,
        orderId: order.orderId,
        sku: product.sku,
        returnDate: order.orderDate,
        reason: "Defective",
        units: int(1, 2),
        refund: (int(20, 200)).toFixed(2),
      });
    }
  }
}

// --- Dirty-data injection: duplicates + blanks ---------------------------
function injectDuplicates(rows, rate) {
  const extra = [];
  for (const row of rows) {
    if (rand() < rate) extra.push({ ...row });
  }
  return [...rows, ...extra];
}

function injectBlanks(rows, fieldRates) {
  return rows.map((row) => {
    const copy = { ...row };
    for (const [field, rate] of Object.entries(fieldRates)) {
      if (rand() < rate) copy[field] = "";
    }
    return copy;
  });
}

const dirtySales = injectBlanks(
  injectDuplicates(salesRows, 0.015),
  { region: 0.02, channel: 0.015, revenue: 0.01 }
);
const dirtyOrders = injectBlanks(
  injectDuplicates(ordersRows, 0.02),
  { region: 0.02, customerId: 0.015 }
);
const dirtyInventory = injectBlanks(inventoryRows, { reorderPoint: 0.03 });
const dirtyReturns = injectBlanks(
  injectDuplicates(returnsRows, 0.02),
  { reason: 0.03 }
);

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function toCsv(headers, rows, keys) {
  const escape = (val) => {
    const str = String(val ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(keys.map((k) => escape(row[k])).join(","));
  }
  return lines.join("\n") + "\n";
}

// Headers intentionally use human/export-style naming that differs from the
// app's canonical field names, to exercise schema-mapping tolerance.
writeFileSync(
  path.join(OUT_DIR, "sample-sales.csv"),
  toCsv(
    ["Date", "SKU", "Product", "Region", "Channel", "Qty", "Unit Price", "Revenue"],
    shuffle(dirtySales),
    ["date", "sku", "product", "region", "channel", "units", "unitPrice", "revenue"]
  )
);

writeFileSync(
  path.join(OUT_DIR, "sample-orders.csv"),
  toCsv(
    ["OrderID", "Order Date", "CustomerID", "Channel", "Region", "Status", "Total"],
    shuffle(dirtyOrders),
    ["orderId", "orderDate", "customerId", "channel", "region", "status", "total"]
  )
);

writeFileSync(
  path.join(OUT_DIR, "sample-inventory.csv"),
  toCsv(
    ["SKU", "Product Name", "Warehouse", "On Hand", "Reorder Pt", "Unit Cost"],
    dirtyInventory,
    ["sku", "productName", "warehouse", "onHand", "reorderPoint", "unitCost"]
  )
);

writeFileSync(
  path.join(OUT_DIR, "sample-returns.csv"),
  toCsv(
    ["ReturnID", "OrderID", "SKU", "Return Date", "Reason", "Units", "Refund"],
    shuffle(dirtyReturns),
    ["returnId", "orderId", "sku", "returnDate", "reason", "units", "refund"]
  )
);

console.log(`Sales:     ${dirtySales.length} rows`);
console.log(`Orders:    ${dirtyOrders.length} rows`);
console.log(`Inventory: ${dirtyInventory.length} rows`);
console.log(`Returns:   ${dirtyReturns.length} rows`);
