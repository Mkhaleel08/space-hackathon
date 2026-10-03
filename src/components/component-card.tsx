import type { ComponentCard as Card, Reading } from "@/lib/types";

const statusStyle: Record<Reading["status"], string> = {
  ok: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  watch: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  alert: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC",
});

export default function ComponentCard({ card }: { card: Card }) {
  return (
    <article className="flex min-w-0 flex-col gap-7 break-words">
      <header>
        <p className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-300">{card.role} view</p>
        <h1 className="text-3xl font-semibold tracking-tight">{card.component.name}</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-300">{card.component.location}</p>
        <div className="mt-4 border-l-4 border-neutral-300 pl-4 dark:border-neutral-700">
          <p className="font-medium">{card.asset.name}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{card.asset.hours.toLocaleString("en-US")} engine hours</p>
        </div>
      </header>
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="text-lg font-semibold">What this part remembers</h2>
        <p className="mt-2 whitespace-pre-wrap leading-relaxed">{card.summary}</p>
      </section>
      <section aria-labelledby="next-step-heading" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <h2 id="next-step-heading" className="text-lg font-semibold">Next step</h2>
        <p className="mt-2 whitespace-pre-wrap leading-relaxed">{card.next_step}</p>
      </section>
      <section aria-labelledby="readings-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="readings-heading" className="text-lg font-semibold">Readings</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">Simulated for this demo</p>
        </div>
        {card.readings.length === 0 ? <p className="mt-3 text-neutral-600 dark:text-neutral-300">No readings available.</p> : (
          <dl className="mt-3 divide-y divide-neutral-200 rounded-xl border border-neutral-200 px-4 dark:divide-neutral-800 dark:border-neutral-800">
            {card.readings.map((reading, index) => (
              <div key={`${reading.label}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <dt className="font-medium">{reading.label}</dt>
                <dd className="flex flex-wrap items-center gap-3">
                  <span className="font-mono">{reading.value}</span>
                  <span className={`rounded px-2 py-1 text-xs font-bold uppercase ${statusStyle[reading.status]}`}>{reading.status}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      <section aria-labelledby="events-heading">
        <h2 id="events-heading" className="text-lg font-semibold">Recent history</h2>
        {card.recent_events.length === 0 ? <p className="mt-3 text-neutral-600 dark:text-neutral-300">No events recorded for this part yet.</p> : (
          <ol className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
            {card.recent_events.slice(0, 5).map((event) => (
              <li key={event.id} className="py-4">
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
