import type { ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="card">
      {title && <div className="h">{title}</div>}
      {children}
    </div>
  );
}

type DotKind = "ok" | "warn" | "err" | "info" | "idle";

/** Map a bwoc status/health string to a status dot colour. */
export function statusDot(status: string): DotKind {
  const s = status.toLowerCase();
  if (["ok", "active", "running"].includes(s)) return "ok";
  if (["warn", "warning", "stopped"].includes(s)) return "warn";
  if (["err", "error", "crashed", "dead"].includes(s)) return "err";
  if (["info"].includes(s)) return "info";
  return "idle";
}

export function Dot({ kind }: { kind: DotKind }) {
  return <span className={cn("dot", kind)} />;
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="err-banner mono">{message}</div>;
}

export function CapBadge({ cap }: { cap: string }) {
  return <span className={cn("badge", cap)}>{cap}</span>;
}
