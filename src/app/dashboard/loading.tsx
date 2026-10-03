import SiteHeader from "@/components/site-header";
import s from "@/components/workspace.module.css";

export default function DashboardLoading() {
  const bar = "animate-pulse rounded-ctl bg-surface";
  return (
    <>
      <SiteHeader active="dashboard" />
      <main
        id="main-content"
        aria-busy="true"
        aria-label="Loading the operator dashboard"
        className={s.workspace}
      >
        <div aria-hidden="true">
          <div className="mb-8 flex flex-col gap-4">
            <div className={`${bar} h-3 w-32`} />
            <div className={`${bar} h-10 w-64`} />
            <div className={`${bar} h-4 w-52`} />
          </div>
          <div className="mb-7 flex gap-6 border-b border-line pb-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`${bar} h-6 w-20`} />
            ))}
          </div>
          <div className={s.conditionGrid}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={s.panel}>
                <div className={`${bar} mb-4 h-4 w-20 max-w-full`} />
                <div className={`${bar} h-8 w-10`} />
              </div>
            ))}
          </div>
          <div className={`${bar} mb-6 h-12 w-full`} />
          <div className={s.dashboardColumns}>
            {[0, 1].map((i) => (
              <div key={i} className={s.panel}>
                <div className={`${bar} mb-5 h-5 w-32`} />
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className={`${bar} mb-4 h-16 w-full`} />
                ))}
              </div>
            ))}
          </div>
        </div>
        <p role="status" className="sr-only">
          Loading the operator dashboard…
        </p>
      </main>
    </>
  );
}
