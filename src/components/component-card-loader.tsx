"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ComponentCard as Card, Role } from "@/lib/types";
import ComponentCard from "./component-card";

type Result = { kind: "loading" } | { kind: "ready"; card: Card } | { kind: "missing" } | { kind: "error" };

export default function ComponentCardLoader({ id, role }: { id: string; role: Role }) {
  const [result, setResult] = useState<Result>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    async function load() {
      try {
        const response = await fetch(`/api/components/${encodeURIComponent(id)}/card?role=${role}`, {
          signal: controller.signal, cache: "no-store",
        });
        if (response.status === 404) {
          if (active) setResult({ kind: "missing" });
          return;
        }
        if (!response.ok) throw new Error("Card request failed");
        const card: Card = await response.json();
        if (active) setResult({ kind: "ready", card });
      } catch {
        if (active) setResult({ kind: "error" });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [id, role, attempt]);

  if (result.kind === "ready") return <ComponentCard card={result.card} />;
  if (result.kind === "loading") return <p role="status" className="min-h-48 py-8 text-neutral-600 dark:text-neutral-300">Loading this part’s history…</p>;
  if (result.kind === "missing") return (
    <section className="min-h-48 py-8">
      <h1 className="text-2xl font-semibold">Not a known part, scan again</h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-300">This label doesn’t match a component in the machine’s history.</p>
      <Link href="/scan" className="mt-5 inline-flex min-h-14 items-center rounded-full bg-black px-6 py-4 font-medium text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-4 dark:bg-white dark:text-black dark:hover:bg-neutral-200">Scan again</Link>
    </section>
  );
  return (
    <section className="min-h-48 py-8">
      <h1 className="text-2xl font-semibold">Couldn’t load this part</h1>
      <p role="alert" className="mt-3 text-neutral-600 dark:text-neutral-300">Check your connection and try again. The machine’s history may be temporarily unavailable.</p>
      <button type="button" onClick={() => { setResult({ kind: "loading" }); setAttempt(value => value + 1); }} className="mt-5 min-h-14 cursor-pointer rounded-full bg-black px-6 py-4 font-medium text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-4 dark:bg-white dark:text-black dark:hover:bg-neutral-200">Try again</button>
    </section>
  );
}
