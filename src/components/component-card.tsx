import type { ReactNode } from "react";
import { ArrowRight } from "./icons";
import s from "./workspace.module.css";
import type { ComponentCard as Card, Reading } from "@/lib/types";
import { LEVEL_TONE, worstOf } from "./dashboard/status";
import StatusMark from "./status-mark";
import { h2, meta } from "./ui";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const shortStatus: Record<Reading["status"], string> = {
  ok: "OK",
  watch: "Watch",
  alert: "Alert",
};

export default function ComponentCard({
  card,
  savedEventId,
  noteForm,
  checklist,
}: {
  card: Card;
  savedEventId?: string;
  noteForm?: ReactNode;
  checklist?: ReactNode;
}) {
  const level = worstOf(card.readings);
  return (
    <article className={s.detailArticle}>
      <header className={s.detailHeader}>
        <div>
          <p className={s.eyebrow}>Component record / {card.component.id}</p>
          <h1>{card.component.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <StatusMark level={level} />
            <span className="text-muted">{card.component.location}</span>
          </div>
        </div>
        <div
          className={s.assetIdentity}
          style={{
            borderLeftColor:
              level === "none" ? "var(--line)" : `var(--${level})`,
          }}
        >
          <span>ASSET</span>
          <strong>{card.asset.name}</strong>
          <span>
            {card.asset.hours.toLocaleString("en-US")} operating hours
          </span>
        </div>
      </header>
      <section aria-labelledby="next-step-heading" className={s.nextAction}>
        <h2 id="next-step-heading">
          <ArrowRight />
          Next step
        </h2>
        <div>
          <p className="whitespace-pre-wrap">{card.next_step}</p>
          {checklist}
        </div>
      </section>
      <div className={s.detailOverview}>
        <section aria-labelledby="summary-heading">
          <h2 id="summary-heading" className={h2}>
            What this part remembers
          </h2>
          <p className="mt-3 max-w-[65ch] whitespace-pre-wrap leading-relaxed text-foreground/90">
            {card.summary}
          </p>
        </section>

        <section aria-labelledby="readings-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="readings-heading" className={h2}>
              Readings
            </h2>
            <p className={meta}>Simulated for this demo</p>
          </div>
          {card.readings.length === 0 ? (
            <p className="mt-3 text-muted">
              No readings for this part. Status comes from notes only.
            </p>
          ) : (
            <dl className={s.readingGrid}>
              {card.readings.map((reading, index) => (
                <div
                  key={`${reading.label}-${index}`}
                  className="flex min-w-0 flex-col"
                >
                  <dt className="text-sm leading-5 text-muted">
                    {reading.label}
                  </dt>
                  <dd className="mt-auto flex flex-col gap-1.5 pt-3">
                    <span className="tabular-nums">{reading.value}</span>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${LEVEL_TONE[reading.status]}`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-current"
                      />
                      {shortStatus[reading.status]}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>
      <div className={s.historyGrid}>
        <section aria-labelledby="events-heading">
          <h2 id="events-heading" tabIndex={-1} className={`${h2} scroll-mt-6`}>
            Recent history
          </h2>
          {card.recent_events.length === 0 ? (
            <p className="mt-3 text-muted">
              No events recorded for this part yet.
            </p>
          ) : (
            <ol className="mt-2 border-t border-line">
              {card.recent_events.slice(0, 5).map((event) => {
                const saved = event.id === savedEventId;
                return (
                  <li
                    key={event.id}
                    data-event-id={event.id}
                    className={`border-b border-line py-4 ${saved ? s.savedEvent : ""}`}
                  >
                    {saved && (
                      <p role="status" className="mb-2">
                        <span className="inline-flex items-center gap-1.5 bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-ink">
                          Just saved
                        </span>
                        <span className="ml-2 text-sm text-muted">
                          Added to this part’s history
                        </span>
                      </p>
                    )}
                    <p className="font-medium leading-snug">{event.summary}</p>
                    <p className="mt-1 text-sm text-muted">
                      <span
                        className={`capitalize ${event.type === "fault" ? "text-alert" : event.type === "repair" ? "text-ok" : ""}`}
                      >
                        {event.type}
                      </span>{" "}
                      · <span className="capitalize">{event.author_role}</span>{" "}
                      ·{" "}
                      <time dateTime={event.created_at}>
                        {Number.isNaN(Date.parse(event.created_at))
                          ? "Date unavailable"
                          : dateFormat.format(new Date(event.created_at))}
                      </time>
                    </p>
                    {event.detail &&
                      event.detail.trim() !== event.summary.trim() && (
                        <details className={s.eventDetail}>
                          <summary>Read full note</summary>
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {event.detail}
                          </p>
                        </details>
                      )}
                    {event.readings && event.readings.length > 0 && (
                      <p className="mt-2 text-xs text-muted">
                        <span className="font-semibold">Readings when saved:</span>{" "}
                        {event.readings.map((r) => `${r.label} ${r.value}`).join(" · ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        {noteForm}
      </div>
    </article>
  );
}
