export default function DashboardLoading() {
  const bar = "animate-pulse rounded-ctl bg-surface";
  return (
    <main aria-busy="true" aria-label="Loading the operator dashboard" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-5 py-6 sm:px-8 sm:py-10">
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between"><div className={`${bar} h-5 w-36`} /><div className={`${bar} h-5 w-28`} /></div>
        <div className="flex flex-col gap-3"><div className={`${bar} h-8 w-64`} /><div className={`${bar} h-4 w-80 max-w-full`} /></div>
        <div className="flex flex-col gap-3">
          <div className={`${bar} h-12 w-full`} />
          <div className="flex gap-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className={`${bar} h-10 w-28`} />)}</div>
        </div>
      </div>
      <div className="flex flex-col gap-12 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-x-16">
        <div className="flex flex-col gap-4 border-t border-line pt-8">
          <div className={`${bar} h-5 w-20`} />
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className={`${bar} h-14 w-full`} />)}
        </div>
        <div className="flex flex-col gap-4 border-t border-line pt-8">
          <div className={`${bar} h-5 w-36`} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className={`${bar} h-16 w-full`} />)}
        </div>
      </div>
      <p role="status" className="sr-only">Loading the operator dashboard…</p>
    </main>
  );
}
