import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ParsedFile = {
  headers: string[];
  rows: Record<string, string>[];
};

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv") return parseCsv(file);
  if (ext === "xls" || ext === "xlsx") return parseExcel(file);

  throw new Error(`Unsupported file type: .${ext ?? "unknown"}`);
}

function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        resolve({ headers: results.meta.fields ?? [], rows: results.data });
      },
      error: (err: Error) => reject(err),
    });
  });
}

async function parseExcel(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  });
  const [headerRow] = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
  });

  return { headers: (headerRow ?? []).map(String), rows };
}
