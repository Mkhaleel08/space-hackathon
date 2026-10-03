import type { ComponentCard as Card, Reading } from "@/lib/types";

const statusStyle: Record<Reading["status"], string> = {
  ok: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  watch: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  alert: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};
const statusLabel: Record<Reading["status"], string> = {
  ok: "Running normal",
  watch: "Watch closely",
  alert: "Needs attention",
};
const statusBorder: Record<Reading["status"], string> = {
  ok: "border-green-500 dark:border-green-400",
  watch: "border-amber-400 dark:border-amber-500",
  alert: "border-red-500 dark:border-red-400",
};
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC",
});

export default function ComponentCard({ card, savedEventId }: { card: Card; savedEventId?: string }) {
  const worst = card.readings.some(reading => reading.status === "alert") ? "alert"
    : card.readings.some(reading => reading.status === "watch") ? "watch" : "ok";
  const hasReadings = card.readings.length > 0;
  return (
    <article className="flex min-w-0 flex-col gap-7 break-words">
      <header>
        <p className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-300">{card.role} view</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{card.component.name}</h1>
          <span className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${hasReadings ? statusStyle[worst] : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"}`}>
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            {hasReadings ? statusLabel[worst] : "No readings"}
          </span>
        </div>
        <p className="mt-2 text-neutral-600 dark:text-neutral-300">{card.component.location}</p>
        <div className={`mt-4 border-l-4 pl-4 ${hasReadings ? statusBorder[worst] : "border-neutral-300 dark:border-neutral-700"}`}>
          <p className="font-medium">{card.asset.name}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{card.asset.hours.toLocaleString("en-US")} engine hours</p>
        </div>
      </header>
      <section aria-labelledby="next-step-heading" className="rounded-2xl border-2 border-amber-400 bg-amber-100 p-5 text-amber-950 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100">
        <h2 id="next-step-heading" className="text-xs font-bold uppercase tracking-wider">Next step</h2>
        <p className="mt-2 whitespace-pre-wrap text-xl font-semibold leading-snug">{card.next_step}</p>
      </section>
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="text-lg font-semibold">What this part remembers</h2>
        <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-neutral-700 dark:text-neutral-300">{card.summary}</p>
      </section>
      <section aria-labelledby="readings-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="readings-heading" className="text-lg font-semibold">Readings</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">Simulated for this demo</p>
        </div>
        {card.readings.length === 0 ? <p className="mt-3 text-neutral-600 dark:text-neutral-300">No readings available.</p> : (
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {card.readings.map((reading, index) => (
              <div key={`${reading.label}-${index}`} className={`min-w-0 rounded-2xl p-3 ${statusStyle[reading.status]}`}>
                <dt className="text-sm font-medium">{reading.label}</dt>
                <dd className="mt-2 flex flex-col gap-2">
                  <span className="font-mono text-sm font-semibold sm:text-base">{reading.value}</span>
                  <span className="text-xs font-bold uppercase">{reading.status}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      <section aria-labelledby="events-heading">
        <h2 id="events-heading" tabIndex={-1} className="scroll-mt-6 rounded text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-4">Recent history</h2>
        {card.recent_events.length === 0 ? <p className="mt-3 text-neutral-600 dark:text-neutral-300">No events recorded for this part yet.</p> : (
          <ol className="mt-4 ml-2 border-l-2 border-neutral-200 dark:border-neutral-800">
            {card.recent_events.slice(0, 5).map((event) => (
              <li key={event.id} data-event-id={event.id} className={`relative pb-6 pl-5 before:absolute before:-left-[5px] before:top-1 before:h-2 before:w-2 before:rounded-full before:bg-neutral-500 ${event.id === savedEventId ? "-mr-3 mb-4 rounded-r-xl bg-amber-50 py-4 pr-3 ring-1 ring-inset ring-amber-200 before:top-5 dark:bg-amber-950/40 dark:ring-amber-800" : ""}`}>
                {event.id === savedEventId && <p role="status" className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-200">Just saved · Added to this part’s history</p>}
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">{event.type} · {event.author_role}</p>
                <p className="mt-1 font-medium leading-relaxed">{event.summary}</p>
                <time dateTime={event.created_at} className="mt-2 block text-sm text-neutral-600 dark:text-neutral-300">
                  {Number.isNaN(Date.parse(event.created_at)) ? "Date unavailable" : `${dateFormat.format(new Date(event.created_at))} UTC`}
                </time>
                {event.detail && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{event.detail}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}
