import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";
import type { ExportData } from "./build-export-data";

Font.registerHyphenationCallback((word) => [word]);

const INK = "#0b0b0b";
const MUTED = "#52514e";
const BRAND = "#3730a3";
const BORDER = "#e1e0d9";
const CRITICAL = "#b91c1c";
const GOOD = "#0f766e";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: INK,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    paddingBottom: 12,
  },
  brand: { fontSize: 12, fontWeight: 700, color: BRAND },
  title: { fontSize: 20, fontWeight: 700, marginTop: 4 },
  meta: { fontSize: 9, color: MUTED, textAlign: "right" },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
    color: INK,
  },
  headline: {
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.4,
    marginBottom: 14,
    padding: 8,
    backgroundColor: "#f4f3fb",
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
  },
  currencyNote: {
    fontSize: 8.5,
    lineHeight: 1.4,
    color: MUTED,
    marginBottom: 14,
    padding: 8,
    backgroundColor: "#f4f4f2",
    borderLeftWidth: 3,
    borderLeftColor: MUTED,
  },
  subsection: { marginBottom: 12 },
  subsectionHeading: {
    fontSize: 8.5,
    fontWeight: 700,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  bulletRow: { flexDirection: "row", marginBottom: 4, paddingRight: 8 },
  bulletMark: { fontSize: 9.5, color: BRAND, marginRight: 6, lineHeight: 1.4 },
  bulletText: { fontSize: 9.5, color: INK, lineHeight: 1.4, flex: 1 },
  table: { borderTopWidth: 1, borderTopColor: BORDER },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    paddingVertical: 6,
    backgroundColor: "#f4f4f2",
  },
  th: { fontSize: 8, fontWeight: 700, color: MUTED, textTransform: "uppercase" },
  td: { fontSize: 9.5, color: INK },
  recCard: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  recTitle: { fontSize: 10, fontWeight: 700 },
  recDetail: { fontSize: 9, color: MUTED, marginTop: 2 },
  recKpi: { fontSize: 8, color: BRAND, marginTop: 3 },
  riskRow: { flexDirection: "row", marginBottom: 6, alignItems: "flex-start" },
  riskDot: { width: 6, height: 6, borderRadius: 3, marginTop: 3, marginRight: 6 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: MUTED,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
});

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>ReportGen — AI Business Report Generator</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function Header({ data }: { data: ExportData }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>REPORTGEN</Text>
        <Text style={styles.title}>Business Performance Report</Text>
      </View>
      <View style={styles.meta}>
        <Text>Reporting period: {data.periodLabel}</Text>
        <Text>Generated: {data.generatedAtLabel}</Text>
      </View>
    </View>
  );
}

export function PdfReportDocument({ data }: { data: ExportData }) {
  return (
    <Document title="Business Performance Report">
      <Page size="A4" style={styles.page}>
        <Header data={data} />

        {data.currencyScopeNote && <Text style={styles.currencyNote}>{data.currencyScopeNote}</Text>}
        {data.channelScopeNote && <Text style={styles.currencyNote}>{data.channelScopeNote}</Text>}

        {data.contextNotes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Business Context</Text>
            {data.contextNotes.map((note, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletMark}>{"•"}</Text>
                <Text style={styles.bulletText}>{note}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <Text style={styles.headline}>{data.headline}</Text>
          {data.sections.map((section, i) => (
            <View key={i} style={styles.subsection}>
              <Text style={styles.subsectionHeading}>{section.heading}</Text>
              {section.bullets.map((bullet, j) => (
                <View key={j} style={styles.bulletRow}>
                  <Text style={styles.bulletMark}>{"•"}</Text>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { flex: 2 }]}>KPI</Text>
              <Text style={[styles.th, { flex: 1 }]}>Current</Text>
              <Text style={[styles.th, { flex: 1 }]}>{data.comparisonLabel}</Text>
              <Text style={[styles.th, { flex: 1 }]}>QoQ</Text>
              <Text style={[styles.th, { flex: 1 }]}>YoY</Text>
            </View>
            {data.kpis.map((kpi) => (
              <View key={kpi.label} style={styles.tableRow}>
                <Text style={[styles.td, { flex: 2 }]}>{kpi.label}</Text>
                <Text style={[styles.td, { flex: 1 }]}>{kpi.current}</Text>
                <Text style={[styles.td, { flex: 1 }]}>{kpi.mom}</Text>
                <Text style={[styles.td, { flex: 1 }]}>{kpi.qoq}</Text>
                <Text style={[styles.td, { flex: 1 }]}>{kpi.yoy}</Text>
              </View>
            ))}
          </View>
        </View>

        {data.risks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Risks &amp; Opportunities</Text>
            {data.risks.map((risk, i) => (
              <View key={i} style={styles.riskRow}>
                <View style={[styles.riskDot, { backgroundColor: risk.type === "risk" ? CRITICAL : GOOD }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9.5, fontWeight: 700 }}>{risk.title}</Text>
                  <Text style={{ fontSize: 9, color: MUTED }}>{risk.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Footer />
      </Page>

      <Page size="A4" style={styles.page}>
        <Header data={data} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended Actions</Text>
          {data.recommendations.map((rec) => (
            <View key={rec.title} style={styles.recCard}>
              <Text style={styles.recTitle}>
                {rec.actioned ? "[Actioned] " : ""}
                {rec.title}
              </Text>
              <Text style={styles.recDetail}>{rec.detail}</Text>
              <Text style={styles.recKpi}>Related KPI: {rec.relatedKpi}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Detected Anomalies (statistical method &amp; threshold shown)
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { flex: 1.6 }]}>Metric / Dimension</Text>
              <Text style={[styles.th, { flex: 1 }]}>Period</Text>
              <Text style={[styles.th, { flex: 1.4 }]}>Observed vs. baseline</Text>
              <Text style={[styles.th, { flex: 1 }]}>Method</Text>
            </View>
            {data.anomalies.map((a, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.td, { flex: 1.6 }]}>
                  {a.metricLabel} — {a.dimensionValue}
                </Text>
                <Text style={[styles.td, { flex: 1 }]}>{a.period}</Text>
                <Text style={[styles.td, { flex: 1.4 }]}>
                  {a.observed} vs. ~{a.baseline} ({a.deviation})
                </Text>
                <Text style={[styles.td, { flex: 1 }]}>{a.method}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top / Bottom Performers (SKU)</Text>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, fontWeight: 700, marginBottom: 4 }}>Top</Text>
              {data.topPerformers.map((p) => (
                <View key={p.dimensionValue} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                  <Text style={styles.td}>{p.dimensionValue}</Text>
                  <Text style={styles.td}>{p.revenue}</Text>
                  <Text style={[styles.td, { color: GOOD }]}>{p.trend}</Text>
                </View>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, fontWeight: 700, marginBottom: 4 }}>Bottom</Text>
              {data.bottomPerformers.map((p) => (
                <View key={p.dimensionValue} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                  <Text style={styles.td}>{p.dimensionValue}</Text>
                  <Text style={styles.td}>{p.revenue}</Text>
                  <Text style={[styles.td, { color: CRITICAL }]}>{p.trend}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Footer />
      </Page>
    </Document>
  );
}
