import { DatasetSchema, DatasetType, mapColumns, ColumnMapping } from "./schema";
import { ParsedFile } from "./parse-file";

export type CanonicalValue = string | number | null;
export type CanonicalRow = Record<string, CanonicalValue>;

/** Placeholder filled into a blank optional string field — not a real
 * business dimension, so trend/anomaly grouping should ignore it. */
export const UNMAPPED_STRING_VALUE = "Unknown";

export type CleaningCounts = {
  totalRawRows: number;
  duplicatesRemoved: number;
  nullsHandled: number;
  rowsDroppedMissingRequired: number;
  typeMismatchesCoerced: number;
  cleanRowCount: number;
};

export type CleaningResult = {
  datasetType: DatasetType;
  mapping: ColumnMapping;
  rows: CanonicalRow[];
  counts: CleaningCounts;
};

/** Drops exact-duplicate raw rows, counting how many were removed. */
export function dedupeRows(rows: Record<string, string>[]): {
  rows: Record<string, string>[];
  duplicatesRemoved: number;
} {
  const seen = new Set<string>();
  let duplicatesRemoved = 0;
  const deduped: Record<string, string>[] = [];

  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(key);
    deduped.push(row);
  }

  return { rows: deduped, duplicatesRemoved };
}

/** Maps raw rows onto the canonical schema, coercing types and filling or
 * dropping missing values — logging a count for every fix. */
export function buildCanonicalRows(
  schema: DatasetSchema,
  mapping: ColumnMapping,
  rawRows: Record<string, string>[]
): {
  rows: CanonicalRow[];
  nullsHandled: number;
  rowsDroppedMissingRequired: number;
  typeMismatchesCoerced: number;
} {
  let nullsHandled = 0;
  let rowsDroppedMissingRequired = 0;
  let typeMismatchesCoerced = 0;
  const rows: CanonicalRow[] = [];

  for (const raw of rawRows) {
    const canonical: CanonicalRow = {};
    let dropRow = false;

    for (const field of schema.fields) {
      const header = mapping.fieldToHeader[field.key];
      const rawValue = header ? (raw[header] ?? "").toString().trim() : "";

      if (!rawValue) {
        if (field.required) {
          dropRow = true;
        } else {
          canonical[field.key] =
            field.type === "number" ? 0 : field.type === "date" ? null : UNMAPPED_STRING_VALUE;
          nullsHandled++;
        }
        continue;
      }

      if (field.type === "number") {
        const num = Number(rawValue.replace(/[$,]/g, ""));
        if (Number.isNaN(num)) {
          if (field.required) {
            dropRow = true;
          } else {
            canonical[field.key] = 0;
            typeMismatchesCoerced++;
          }
        } else {
          canonical[field.key] = num;
        }
      } else if (field.type === "date") {
        const date = new Date(rawValue);
        if (Number.isNaN(date.getTime())) {
          if (field.required) {
            dropRow = true;
          } else {
            canonical[field.key] = null;
            typeMismatchesCoerced++;
          }
        } else {
          canonical[field.key] = date.toISOString().slice(0, 10);
        }
      } else {
        canonical[field.key] = rawValue;
      }
    }

    if (dropRow) {
      rowsDroppedMissingRequired++;
      continue;
    }
    rows.push(canonical);
  }

  return { rows, nullsHandled, rowsDroppedMissingRequired, typeMismatchesCoerced };
}

/** Full pipeline: schema mapping -> dedupe -> type coercion/null handling. */
export function cleanDataset(schema: DatasetSchema, parsed: ParsedFile): CleaningResult {
  const mapping = mapColumns(schema, parsed.headers);
  const { rows: dedupedRaw, duplicatesRemoved } = dedupeRows(parsed.rows);
  const { rows, nullsHandled, rowsDroppedMissingRequired, typeMismatchesCoerced } =
    buildCanonicalRows(schema, mapping, dedupedRaw);

  return {
    datasetType: schema.type,
    mapping,
    rows,
    counts: {
      totalRawRows: parsed.rows.length,
      duplicatesRemoved,
      nullsHandled,
      rowsDroppedMissingRequired,
      typeMismatchesCoerced,
      cleanRowCount: rows.length,
    },
  };
}
