"use client";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="min-h-12 cursor-pointer rounded-full bg-black px-6 font-medium text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-4 dark:bg-white dark:text-black dark:hover:bg-neutral-200">
      Print
    </button>
  );
}
