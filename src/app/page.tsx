import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { ArrowRight, Camera, Grid, Scan } from "@/components/icons";
import { btnPrimary } from "@/components/ui";
import s from "@/components/workspace.module.css";

export default function Home() {
  return (
    <>
      <SiteHeader active="home" />
      <main id="main-content" className={s.home}>
        <section className={s.hero}>
          <div className={s.heroCopy}>
            <p className={s.eyebrow}>
              <span className={s.smallMark} /> Knowledge from the field
            </p>
            <h1>
              Every machine
              <br />
              has a <span>memory.</span>
            </h1>
            <p className={s.heroDescription}>
              The last repair. The first warning. The next step.
              <br className={s.desktopBreak} /> Put the whole story in the hands
              of the person on site.
            </p>
            <Link href="/ar" className={`${btnPrimary} ${s.heroAction}`}>
              <Camera className="h-5 w-5" /> Open live view{" "}
              <ArrowRight className="h-5 w-5" />
            </Link>
            <p className={s.heroHint}>
              Point at a label. Get the history. Leave what you know.
            </p>
          </div>
          <div className={s.fieldPanel} aria-label="How Machine Memory works">
            <div className={s.fieldPanelTop}>
              <span>FIELD WORKSPACE</span>
              <Scan className="h-5 w-5" />
            </div>
            <div className={s.scope} aria-hidden="true">
              <span className={s.scopeCorner} />
              <span className={s.scopeCorner} />
              <span className={s.scopeCorner} />
              <span className={s.scopeCorner} />
              <svg
                viewBox="0 0 240 180"
                fill="none"
                className={s.machineDrawing}
              >
                <g
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                >
                  <path d="M48 68 98 43l89 39-51 29zM48 68v56l88 38 51-26V82M136 111v51M70 79l49 21M70 91l49 21M70 103l49 21M157 110v28M169 104v28" />
                  <path d="m98 43 1-22 89 38-1 23M99 21l-15 8v21M99 33l73 31M48 99l-16 8v35l52 23 18-9M32 107l52 23v35M48 124l36 16" />
                  <circle cx="163" cy="83" r="7" />
                  <path d="M145 64 167 74M52 151v14M65 157v14M136 162v10M179 140v12" />
                </g>
              </svg>
              <span className={s.scopeLabel}>
                A history attached to every part
              </span>
            </div>
            <ol className={s.fieldSteps}>
              <li>
                <span>01</span>
                <div>
                  <strong>Identify the part</strong>
                  <p>Recognize its label in live view.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Understand the history</strong>
                  <p>Read the condition and next step.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Leave it better informed</strong>
                  <p>Speak or type a note for the next person.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>
        <section className={s.homeRoutes} aria-label="More ways to work">
          <Link href="/dashboard" className={s.routeCard}>
            <span className={s.routeIcon}>
              <Grid className="h-6 w-6" />
            </span>
            <div>
              <span className={s.eyebrow}>Across the operation</span>
              <h2>See the bigger picture</h2>
              <p>
                Asset conditions, worker notes, and AprilTags in one workspace.
              </p>
            </div>
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link href="/scan" className={s.routeCard}>
            <span className={s.routeIcon}>
              <Scan className="h-6 w-6" />
            </span>
            <div>
              <span className={s.eyebrow}>At the machine</span>
              <h2>Go straight to a part</h2>
              <p>Scan a QR label or choose a part to open its full history.</p>
            </div>
            <ArrowRight className="h-5 w-5" />
          </Link>
        </section>
        <footer className={s.footer}>
          <span>Machine Memory</span>
          <span>Built for the next person on site.</span>
        </footer>
      </main>
    </>
  );
}
