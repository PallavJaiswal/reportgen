export type DatasetType = "sales" | "orders" | "inventory" | "returns";

export type FieldType = "string" | "number" | "date";

export type SchemaField = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  aliases: string[];
};

export type DatasetSchema = {
  type: DatasetType;
  label: string;
  fields: SchemaField[];
};

/** Lowercases and strips everything but letters/digits, so "Order Date",
 * "order_date", and "OrderDate" all normalize to "orderdate" for matching. */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const SALES_SCHEMA: DatasetSchema = {
  type: "sales",
  label: "Sales",
  fields: [
    {
      key: "date",
      label: "Date",
      type: "date",
      required: true,
      aliases: ["date", "saledate", "transactiondate", "purchasedate", "dateofsale", "invoicedate", "orderdate"],
    },
    {
      key: "sku",
      label: "SKU",
      type: "string",
      required: true,
      aliases: ["sku", "productsku", "itemsku", "productcode", "asin", "itemid", "productid"],
    },
    {
      key: "product",
      label: "Product",
      type: "string",
      required: false,
      aliases: ["product", "productname", "itemname", "description", "producttitle", "itemtitle", "title"],
    },
    {
      key: "region",
      label: "Region",
      type: "string",
      required: false,
      aliases: ["region", "salesregion", "territory", "shipstate", "state", "market", "country"],
    },
    {
      key: "channel",
      label: "Channel",
      type: "string",
      required: false,
      aliases: ["channel", "saleschannel", "marketplace", "platform"],
    },
    {
      key: "units",
      label: "Units",
      type: "number",
      required: true,
      aliases: ["units", "unitssold", "qty", "quantity", "qtyordered", "unitsordered"],
    },
    {
      key: "unitPrice",
      label: "Unit price",
      type: "number",
      required: false,
      aliases: ["unitprice", "price", "priceperunit", "itemprice", "saleprice", "soldfor"],
    },
    {
      key: "revenue",
      label: "Revenue",
      type: "number",
      required: true,
      aliases: ["revenue", "sales", "amount", "total", "netrevenue", "itemtotal", "linetotal", "grosssales"],
    },
    {
      key: "currency",
      label: "Currency",
      type: "string",
      required: false,
      aliases: ["currency", "currencycode", "curr"],
    },
  ],
};

const ORDERS_SCHEMA: DatasetSchema = {
  type: "orders",
  label: "Orders",
  fields: [
    {
      key: "orderId",
      label: "Order ID",
      type: "string",
      required: true,
      aliases: ["orderid", "order", "orderno", "ordernumber", "transactionid"],
    },
    {
      key: "orderDate",
      label: "Order date",
      type: "date",
      required: true,
      aliases: ["orderdate", "date", "purchasedate", "dateoforder", "orderedon", "saledate"],
    },
    {
      key: "customerId",
      label: "Customer ID",
      type: "string",
      required: false,
      aliases: ["customerid", "custid", "customer", "buyerid", "buyerusername", "buyername"],
    },
    {
      key: "channel",
      label: "Channel",
      type: "string",
      required: false,
      aliases: ["channel", "saleschannel", "marketplace", "platform"],
    },
    {
      key: "region",
      label: "Region",
      type: "string",
      required: false,
      aliases: ["region", "territory", "shipstate", "state", "country"],
    },
    {
      key: "status",
      label: "Status",
      type: "string",
      required: false,
      aliases: ["status", "orderstatus", "shipmentstatus", "fulfillmentstatus"],
    },
    {
      key: "total",
      label: "Order total",
      type: "number",
      required: true,
      aliases: ["total", "ordertotal", "amount", "revenue", "grandtotal", "amountpaid"],
    },
    {
      key: "currency",
      label: "Currency",
      type: "string",
      required: false,
      aliases: ["currency", "currencycode", "curr"],
    },
  ],
};

const INVENTORY_SCHEMA: DatasetSchema = {
  type: "inventory",
  label: "Inventory",
  fields: [
    {
      key: "sku",
      label: "SKU",
      type: "string",
      required: true,
      aliases: ["sku", "productsku", "itemsku", "asin", "itemid", "productid"],
    },
    {
      key: "productName",
      label: "Product name",
      type: "string",
      required: false,
      aliases: ["productname", "product", "itemname", "description", "producttitle", "itemtitle", "title"],
    },
    {
      key: "warehouse",
      label: "Warehouse",
      type: "string",
      required: false,
      aliases: ["warehouse", "location", "dc", "distributioncenter", "fulfillmentcenter"],
    },
    {
      key: "onHand",
      label: "On-hand units",
      type: "number",
      required: true,
      aliases: ["onhand", "onhandunits", "quantity", "stock", "unitsonhand", "quantityavailable", "availableqty", "stockqty"],
    },
    {
      key: "reorderPoint",
      label: "Reorder point",
      type: "number",
      required: false,
      aliases: ["reorderpoint", "reorderpt", "reorderlevel", "minstock", "reorderthreshold", "safetystock"],
    },
    {
      key: "unitCost",
      label: "Unit cost",
      type: "number",
      required: false,
      aliases: ["unitcost", "cost", "costperunit", "costprice", "cogs"],
    },
  ],
};

const RETURNS_SCHEMA: DatasetSchema = {
  type: "returns",
  label: "Returns",
  fields: [
    {
      key: "returnId",
      label: "Return ID",
      type: "string",
      required: false,
      aliases: ["returnid", "rmaid", "returnno", "rmanumber", "returnnumber", "claimid"],
    },
    {
      key: "orderId",
      label: "Order ID",
      type: "string",
      required: false,
      aliases: ["orderid", "order", "ordernumber", "transactionid"],
    },
    {
      key: "sku",
      label: "SKU",
      type: "string",
      required: true,
      aliases: ["sku", "productsku", "itemsku", "asin", "itemid", "productid"],
    },
    {
      key: "returnDate",
      label: "Return date",
      type: "date",
      required: true,
      aliases: ["returndate", "date", "dateofreturn", "refunddate"],
    },
    {
      key: "reason",
      label: "Reason",
      type: "string",
      required: false,
      aliases: ["reason", "returnreason", "reasonforreturn"],
    },
    {
      key: "units",
      label: "Units returned",
      type: "number",
      required: true,
      aliases: ["units", "unitsreturned", "qty", "quantity", "quantityreturned"],
    },
    {
      key: "refund",
      label: "Refund amount",
      type: "number",
      required: false,
      aliases: ["refund", "refundamount", "amount", "amountrefunded", "refundtotal"],
    },
    {
      key: "currency",
      label: "Currency",
      type: "string",
      required: false,
      aliases: ["currency", "currencycode", "curr"],
    },
  ],
};

export const DATASET_SCHEMAS: Record<DatasetType, DatasetSchema> = {
  sales: SALES_SCHEMA,
  orders: ORDERS_SCHEMA,
  inventory: INVENTORY_SCHEMA,
  returns: RETURNS_SCHEMA,
};

export type FieldMatchType = "exact" | "fuzzy" | "manual" | "none";

export type ColumnMapping = {
  /** schema field key -> raw header from the file, or null if unmatched */
  fieldToHeader: Record<string, string | null>;
  /** how each field's mapping was decided — lets the UI flag low-confidence
   * guesses for user review instead of silently trusting them */
  matchType: Record<string, FieldMatchType>;
  /** raw headers that didn't map to any known field */
  unmappedHeaders: string[];
  /** required schema fields that had no matching header */
  missingRequiredFields: string[];
};

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[rows - 1][cols - 1];
}

/** 0..1, where 1 is identical. Catches typos and minor variations that
 * substring matching misses (e.g. "Prodcut Name" vs "productname"). */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

const SIMILARITY_THRESHOLD = 0.8;

const IDENTIFIER_WORD_TOKENS = new Set(["id", "no", "num", "number", "code"]);

/** Splits a raw (un-normalized) header into word tokens on camelCase and
 * non-alphanumeric boundaries, e.g. "sales-record-id" -> ["sales","record","id"]. */
function wordTokens(rawHeader: string): string[] {
  return rawHeader
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .map((w) => w.toLowerCase())
    .filter(Boolean);
}

/** True if the header is shaped like an identifier column ("sales-record-id",
 * "amazon-order-id", "purchase-order-number"). Used to stop a generic alias
 * (e.g. "sales" for revenue, "total" for a grand-total field) from fuzzy-
 * matching a numeric/date field onto an ID column that merely starts with
 * that word — a real bug found against an Amazon seller report, where
 * Revenue matched "sales-record-id" ahead of the actual "item-price-total"
 * column. String-type fields (orderId, sku, returnId, ...) are exempt since
 * matching an ID-shaped header is exactly what they want. */
function looksLikeIdentifierHeader(rawHeader: string): boolean {
  return wordTokens(rawHeader).some((token) => IDENTIFIER_WORD_TOKENS.has(token));
}

/** Matches raw file headers to canonical schema fields, tolerating
 * different column layouts/naming across uploads (spacing, casing,
 * synonyms, and minor typos). `manualOverrides` lets a user pin a field to
 * a specific header (or explicitly clear it) — those win over auto-detection. */
export function mapColumns(
  schema: DatasetSchema,
  rawHeaders: string[],
  manualOverrides: Record<string, string | null> = {}
): ColumnMapping {
  const normalizedHeaders = rawHeaders.map((h) => ({
    raw: h,
    normalized: normalizeHeader(h),
  }));
  const usedHeaders = new Set<string>();
  const fieldToHeader: Record<string, string | null> = {};
  const matchType: Record<string, FieldMatchType> = {};

  // Manual overrides are applied first so they reserve their header before
  // auto-detection runs for the remaining fields.
  for (const field of schema.fields) {
    if (!Object.prototype.hasOwnProperty.call(manualOverrides, field.key)) continue;
    const chosen = manualOverrides[field.key];
    fieldToHeader[field.key] = chosen;
    matchType[field.key] = chosen ? "manual" : "none";
    if (chosen) usedHeaders.add(chosen);
  }

  for (const field of schema.fields) {
    if (Object.prototype.hasOwnProperty.call(fieldToHeader, field.key)) continue;

    const exact = normalizedHeaders.find(
      (h) => !usedHeaders.has(h.raw) && field.aliases.includes(h.normalized)
    );
    if (exact) {
      fieldToHeader[field.key] = exact.raw;
      matchType[field.key] = "exact";
      usedHeaders.add(exact.raw);
      continue;
    }

    // Only the header-contains-alias direction is safe for fuzzy substring
    // matching. The reverse (alias.includes(header)) lets a short, generic
    // header match into an unrelated longer alias it happens to be a
    // substring of — e.g. "Price" matched the unitCost field because
    // "costprice" contains "price", even though price and cost are opposite
    // concepts. Also found against a real Amazon seller report.
    const substring = normalizedHeaders.find(
      (h) =>
        !usedHeaders.has(h.raw) &&
        !(field.type !== "string" && looksLikeIdentifierHeader(h.raw)) &&
        field.aliases.some((alias) => h.normalized.includes(alias))
    );
    if (substring) {
      fieldToHeader[field.key] = substring.raw;
      matchType[field.key] = "fuzzy";
      usedHeaders.add(substring.raw);
      continue;
    }

    let best: { raw: string; score: number } | null = null;
    for (const h of normalizedHeaders) {
      if (usedHeaders.has(h.raw)) continue;
      if (field.type !== "string" && looksLikeIdentifierHeader(h.raw)) continue;
      for (const alias of field.aliases) {
        const score = similarity(h.normalized, alias);
        if (!best || score > best.score) best = { raw: h.raw, score };
      }
    }
    if (best && best.score >= SIMILARITY_THRESHOLD) {
      fieldToHeader[field.key] = best.raw;
      matchType[field.key] = "fuzzy";
      usedHeaders.add(best.raw);
    } else {
      fieldToHeader[field.key] = null;
      matchType[field.key] = "none";
    }
  }

  const unmappedHeaders = rawHeaders.filter((h) => !usedHeaders.has(h));
  const missingRequiredFields = schema.fields
    .filter((f) => f.required && !fieldToHeader[f.key])
    .map((f) => f.label);

  return { fieldToHeader, matchType, unmappedHeaders, missingRequiredFields };
}
