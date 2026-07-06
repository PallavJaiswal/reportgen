import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { isPublicDemo } from "@/lib/is-public-demo";

export function SiteHeader() {
  const demo = isPublicDemo();

  return (
    <header className="border-b border-border/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-brand-foreground text-sm font-semibold">
            R
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Report<span className="text-muted-foreground">Gen</span>
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/upload" className="transition-colors hover:text-foreground">
            {demo ? "Try live demo" : "Upload data"}
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
