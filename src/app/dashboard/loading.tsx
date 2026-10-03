export default function DashboardLoading() {
  const block = "animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800";
  return (
    <main aria-busy="true" aria-label="Loading the operator dashboard" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4">
        <div className={`${block} h-5 w-32 rounded`} />
        <div className={`${block} h-9 w-72 rounded-lg`} />
        <div className={`${block} h-11 w-full`} />
        <div className="flex gap-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className={`${block} h-9 w-28`} />)}</div>
      </div>
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <div className={`${block} h-64`} />
          <div className={`${block} h-64`} />
        </div>
        <div className={`${block} h-96`} />
      </div>
      <p role="status" className="sr-only">Loading the operator dashboard…</p>
    </main>
  );
}
