import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { isPublicDemo } from "@/lib/is-public-demo";
import {
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  GitBranch,
  Trophy,
  Lightbulb,
  MessageCircleQuestion,
  FileOutput,
  SlidersHorizontal,
} from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Visible data cleaning",
    description:
      "Every duplicate removed, null handled, and schema mismatch resolved — shown with counts, not hidden.",
  },
  {
    icon: TrendingUp,
    title: "Real anomaly detection",
    description:
      "Z-score, IQR, and seasonal baseline methods — the UI states which method and threshold flagged each anomaly.",
  },
  {
    icon: GitBranch,
    title: "Root-cause drill-down",
    description:
      "Every anomaly and insight is clickable through to the exact source rows, SKUs, or regions behind it.",
  },
  {
    icon: Trophy,
    title: "Top / bottom performers",
    description:
      "Automatic ranking across SKUs, regions, and channels by contribution and trend.",
  },
  {
    icon: Lightbulb,
    title: "Recommended actions",
    description:
      "AI-generated actions tied to specific KPIs — and tracked closed-loop across report runs.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Natural-language Q&A",
    description:
      "Ask questions like “why did margins drop in the West region?” directly over your data.",
  },
  {
    icon: SlidersHorizontal,
    title: "Configurable thresholds",
    description:
      "Anomaly sensitivity and schema mapping adapt to your data — nothing is hardcoded to one layout.",
  },
  {
    icon: FileOutput,
    title: "Boardroom-ready export",
    description:
      "PDF and Excel exports styled as a professional management report, not a raw data dump.",
  },
];

export default function LandingPage() {
  const demo = isPublicDemo();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center sm:pt-28">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">
            AI business report generator
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Raw sales data in.
            <br />
            An executive-ready report out.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-muted-foreground">
            Upload Sales, Orders, Inventory, and Returns files and get
            validated data, statistically-detected anomalies with root-cause
            drill-down, and AI-written recommendations — not just a chatbot
            wrapper.
          </p>
          <div className="mt-8 flex items-center justify-center">
            <Button size="lg" className="gap-2" render={<Link href="/upload" />}>
              {demo ? "Try live demo" : "Get started"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {demo
              ? "One free AI-powered analysis per visitor on this public demo."
              : "Running locally — unlimited use with your own Anthropic key."}
          </p>
        </section>

        <section className="border-t border-border/60 bg-muted/30">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-px px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="border-none shadow-none bg-transparent">
                <CardHeader className="pb-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <feature.icon className="h-4.5 w-4.5" />
                  </span>
                  <CardTitle className="mt-3 text-sm">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 text-xs text-muted-foreground sm:flex-row">
          <p>Built as a portfolio project — not affiliated with any employer.</p>
          <p>Next.js &middot; TypeScript &middot; Anthropic &amp; Groq</p>
        </div>
      </footer>
    </div>
  );
}
