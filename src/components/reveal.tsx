"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Expand and collapse with height animated from 0 to auto, no measuring.
 * The wrapper is a one-row grid whose track grows (see .reveal in
 * globals.css). Children stay mounted while closing so the exit can play,
 * then unmount so hidden controls leave the tab order.
 */
export default function Reveal({ open, id, className = "", children }: {
  open: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const [rendered, setRendered] = useState(open);
  // Opening mounts the children at once; closing waits for the exit transition.
  if (open && !rendered) setRendered(true);
  return (
    <div
      id={id}
      className={`reveal ${className}`}
      data-open={open ? "true" : "false"}
      aria-hidden={open ? undefined : true}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === "grid-template-rows" && !open) setRendered(false);
      }}
    >
      <div>{rendered ? children : null}</div>
    </div>
  );
}
