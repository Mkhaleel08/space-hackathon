/**
 * Shared control vocabulary. Same button, same field, same link on every
 * screen. Focus rings come from globals.css, so nothing here sets them.
 * Presses give 100 ms of scale feedback; colours ease out over 150 ms.
 */
const btn = "inline-flex min-h-12 cursor-pointer select-none items-center justify-center gap-2 rounded-ctl px-5 text-base font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out-expo active:scale-[0.985] active:duration-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

/** One per page: the thing the visitor came to do. */
export const btnPrimary = `${btn} bg-accent text-accent-ink hover:bg-[#f0bf0a] active:bg-[#e3b400] disabled:hover:bg-accent`;
/** The alternative to the primary. */
export const btnSecondary = `${btn} border border-foreground bg-transparent hover:bg-surface`;
/** Everything else that is a button. */
export const btnGhost = `${btn} border border-line bg-transparent hover:border-muted hover:bg-surface`;
/** Destructive, confirmed in a dialog. */
export const btnDanger = `${btn} bg-alert text-white hover:opacity-90`;
/** Small variant for toolbars and rows. */
export const btnSmall = "min-h-10 px-3.5 text-sm";

export const field = "min-h-12 w-full rounded-ctl border border-line bg-background px-3 text-base text-foreground transition-colors duration-150 placeholder:text-muted hover:border-muted focus-visible:border-foreground disabled:opacity-50";
export const fieldLabel = "flex flex-col gap-1.5 text-sm font-medium";

export const textLink = "inline-flex min-h-11 items-center gap-1.5 font-medium underline decoration-line underline-offset-4 transition-colors duration-150 hover:decoration-foreground";
export const meta = "text-sm text-muted";
/** Page titles: the nameplate cut. */
export const h1 = "font-display text-[1.875rem] font-semibold leading-[1.1] tracking-tight";
export const h2 = "text-base font-semibold leading-tight";
export const section = "border-t border-line pt-8";
