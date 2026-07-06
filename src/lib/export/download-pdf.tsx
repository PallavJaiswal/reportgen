import { pdf } from "@react-pdf/renderer";
import { PdfReportDocument } from "./pdf-document";
import type { ExportData } from "./build-export-data";

export async function downloadPdfReport(data: ExportData): Promise<void> {
  const blob = await pdf(<PdfReportDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const filename = `business-report-${data.periodLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
