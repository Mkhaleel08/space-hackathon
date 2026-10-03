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
                  {/* Hydraulic excavator, right side: tracks, house, cab, boom, stick, bucket */}
                  <path d="M102 140h112a14 14 0 0 1 0 28H102a14 14 0 0 1 0-28z" />
                  <circle cx="102" cy="154" r="8" />
                  <circle cx="214" cy="154" r="8" />
                  <path d="M124 159a4 4 0 1 0 .01 0M144 159a4 4 0 1 0 .01 0M164 159a4 4 0 1 0 .01 0M184 159a4 4 0 1 0 .01 0" />
                  <path d="M114 164v4M128 164v4M142 164v4M156 164v4M170 164v4M184 164v4M198 164v4" />
                  <path d="M136 140v-12h64v12M126 128h84" />
                  <path d="M118 128V96h104a10 10 0 0 1 10 10v22M196 106h22M196 112h22M196 118h22M206 96v-9M203 87h6" />
                  <path d="M118 96V80a8 8 0 0 1 8-8h22a6 6 0 0 1 6 6v18M124 78h22v14h-22z" />
                  <path d="M156 102 108 45 65 67l6 10 33-20 41 55z" />
                  <path d="M127 67l-26-5-1 7 26 5zM101 66 76 61" />
                  <path d="M123 119l3-22 7 1-3 22zM128 97l-2-13" />
                  <path d="M78 61 51 130 41 126 68 57z" />
                  <path d="M65 79 56 101 50 99 59 77zM53 100l-6 16" />
                  <path d="M46 128c-14 4-20 20-12 32l10 8 22-4-4-22zM50 167v5M57 166v5M64 164v5" />
                  <circle cx="150" cy="106" r="3" />
                  <circle cx="68" cy="72" r="2.5" />
                  <circle cx="46" cy="128" r="2.5" />
                  <path d="M20 174h212" strokeDasharray="3 5" />
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
