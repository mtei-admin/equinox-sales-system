"use client";

import { useEffect } from "react";

export function PrintToolbar({ backHref }: { backHref: string }) {
  useEffect(() => {
    const id = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="print-toolbar">
      <a href={backHref}>Back</a>
      <button type="button" onClick={() => window.print()}>
        Print
      </button>
    </div>
  );
}
