import Link from "next/link";
import { Camera, Grid, Scan } from "./icons";
import s from "./workspace.module.css";

export default function SiteHeader({
  active,
}: {
  active?: "home" | "dashboard" | "scan";
}) {
  return (
    <header className={s.siteHeader}>
      <a href="#main-content" className={s.skipLink}>
        Skip to content
      </a>
      <div className={s.headerInner}>
        <Link href="/" aria-label="Machine Memory home" className={s.brand}>
          <span aria-hidden="true" className={s.brandMark}>
            <i />
            <i />
            <i />
          </span>
          <span>
            Machine<span className={s.brandMuted}>Memory</span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className={s.mainNav}>
          <Link
            href="/dashboard"
            aria-current={active === "dashboard" ? "page" : undefined}
          >
            <Grid />
            <span>Dashboard</span>
          </Link>
          <Link
            href="/scan"
            aria-current={active === "scan" ? "page" : undefined}
          >
            <Scan />
            <span>Scan a part</span>
          </Link>
          <Link href="/ar" className={s.liveLink}>
            <Camera />
            <span>Live view</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
