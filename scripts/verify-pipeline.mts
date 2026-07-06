// One-off sanity check of the parsing/cleaning pipeline against the sample
// CSVs — not a permanent test, just a quick way to eyeball real counts.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { DATASET_SCHEMAS, mapColumns, type DatasetType } from "../src/lib/data/schema";
import { dedupeRows, buildCanonicalRows, type CleaningResult } from "../src/lib/data/clean-dataset";
import { crossReferenceDatasets } from "../src/lib/data/cross-reference";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "public", "sample-data");

const FILES: Record<DatasetType, string> = {
  sales: "sample-sales.csv",
  orders: "sample-orders.csv",
  inventory: "sample-inventory.csv",
  returns: "sample-returns.csv",
};

const results: Partial<Record<DatasetType, CleaningResult>> = {};

for (const [key, filename] of Object.entries(FILES) as [DatasetType, string][]) {
  const text = readFileSync(path.join(DATA_DIR, filename), "utf-8");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const schema = DATASET_SCHEMAS[key];
  const mapping = mapColumns(schema, parsed.meta.fields ?? []);
  const { rows: deduped, duplicatesRemoved } = dedupeRows(parsed.data);
  const built = buildCanonicalRows(schema, mapping, deduped);

  results[key] = {
    datasetType: key,
    mapping,
    rows: built.rows,
    counts: {
      totalRawRows: parsed.data.length,
      duplicatesRemoved,
      nullsHandled: built.nullsHandled,
      rowsDroppedMissingRequired: built.rowsDroppedMissingRequired,
      typeMismatchesCoerced: built.typeMismatchesCoerced,
      cleanRowCount: built.rows.length,
    },
  };

  console.log(`\n== ${key} ==`);
  console.log("field -> header mapping:", mapping.fieldToHeader);
  console.log("unmapped headers:", mapping.unmappedHeaders);
  console.log("missing required fields:", mapping.missingRequiredFields);
  console.log("counts:", results[key]!.counts);
}

console.log("\n== cross-reference ==");
console.log(crossReferenceDatasets(results));
