import type { ComponentCard as Card, Reading } from "@/lib/types";
import { LEVEL_TONE, worstOf } from "./dashboard/status";
import StatusMark from "./status-mark";
import { h2, meta } from "./ui";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC",
});
const shortStatus: Record<Reading["status"], string> = { ok: "OK", watch: "Watch", alert: "Alert" };

export default function ComponentCard({ card, savedEventId }: { card: Card; savedEventId?: string }) {
  const level = worstOf(card.readings);
  return (
    <article className="flex min-w-0 flex-col gap-12 break-words">
      <header>
        <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-tight">{card.component.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <StatusMark level={level} />
          <span className="text-muted">{card.component.location}</span>
        </div>
        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 border-t border-line pt-4 text-sm">
          <dt className="text-muted">Machine</dt>
          <dd className="font-medium">{card.asset.name}</dd>
          <dt className="text-muted">Hours</dt>
          <dd className="font-medium tabular-nums">{card.asset.hours.toLocaleString("en-US")}</dd>
        </dl>
      </header>

      <section aria-labelledby="next-step-heading">
        <h2 id="next-step-heading" className="flex items-center gap-2.5 text-sm font-semibold">
          <span aria-hidden="true" className="h-2.5 w-2.5 bg-accent" />
          Next step
        </h2>
        <p className="mt-3 max-w-[32ch] whitespace-pre-wrap text-balance text-[1.375rem] font-semibold leading-snug">{card.next_step}</p>
      </section>

      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className={h2}>What this part remembers</h2>
        <p className="mt-3 max-w-[65ch] whitespace-pre-wrap leading-relaxed text-foreground/90">{card.summary}</p>
      </section>

      <section aria-labelledby="readings-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="readings-heading" className={h2}>Readings</h2>
          <p className={meta}>Simulated for this demo</p>
        </div>
        {card.readings.length === 0 ? <p className="mt-3 text-muted">No readings for this part. Status comes from notes only.</p> : (
          <dl className="mt-4 grid grid-cols-3 gap-px border border-line bg-line">
            {card.readings.map((reading, index) => (
              <div key={`${reading.label}-${index}`} className="min-w-0 bg-background p-3 sm:p-4">
                <dt className="text-sm text-muted">{reading.label}</dt>
                <dd className="mt-3 flex flex-col gap-1.5">
                  <span className="font-mono text-sm font-medium tabular-nums sm:text-lg">{reading.value}</span>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${LEVEL_TONE[reading.status]}`}>
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                    {shortStatus[reading.status]}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section aria-labelledby="events-heading">
        <h2 id="events-heading" tabIndex={-1} className={`${h2} scroll-mt-6`}>Recent history</h2>
        {card.recent_events.length === 0 ? <p className="mt-3 text-muted">No events recorded for this part yet.</p> : (
          <ol className="mt-2 border-t border-line">
            {card.recent_events.slice(0, 5).map((event) => {
              const saved = event.id === savedEventId;
              return (
                <li key={event.id} data-event-id={event.id} className="border-b border-line py-4">
                  {saved && (
                    <p role="status" className="mb-2">
                      <span className="inline-flex items-center gap-1.5 bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-ink">Just saved</span>
                      <span className="ml-2 text-sm text-muted">Added to this part’s history</span>
                    </p>
                  )}
                  <p className="font-medium leading-snug">{event.summary}</p>
                  <p className="mt-1 text-sm text-muted">
                    <span className="capitalize">{event.type}</span> · <span className="capitalize">{event.author_role}</span> ·{" "}
                    <time dateTime={event.created_at}>
                      {Number.isNaN(Date.parse(event.created_at)) ? "Date unavailable" : `${dateFormat.format(new Date(event.created_at))} UTC`}
                    </time>
                  </p>
                  {event.detail && event.detail.trim() !== event.summary.trim() && (
                    <p className="mt-2 max-w-[65ch] whitespace-pre-wrap text-sm leading-relaxed text-muted">{event.detail}</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </article>
  );
}
