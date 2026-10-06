import type { ReactNode } from "react";

type EventKind = "cup" | "challenge" | "prerelease" | "tournament" | "other";

function eventKind(type: string): EventKind {
  const value = type.toLocaleLowerCase("fr-FR");
  if (value.includes("cup")) return "cup";
  if (value.includes("challenge")) return "challenge";
  if (value.includes("avant") || value.includes("prerelease")) return "prerelease";
  if (value.includes("tournoi")) return "tournament";
  return "other";
}

export function EventTypeMark({ type, size = "normal" }: { type: string; size?: "normal" | "small" | "large" }) {
  const kind = eventKind(type);
  const paths: Record<EventKind, ReactNode> = {
    cup: <><path d="M8 5h8v5a4 4 0 0 1-8 0V5Z" /><path d="M8 7H5v2a3 3 0 0 0 3 3m8-5h3v2a3 3 0 0 1-3 3m-4 2v4m-4 1h8" /></>,
    challenge: <><path d="m4 18 5.5-8 3.3 4 2.2-3L20 18H4Z" /><path d="M10 10V5h6l-1.5 2L16 9h-6" /></>,
    prerelease: <><rect x="5" y="6" width="11" height="14" rx="1.8" /><path d="m9 6 1-2h9v13l-3 1M8.5 12h4m-2-2v4" /><path d="m18 3 .4-1 .4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4Z" /></>,
    tournament: <><circle cx="12" cy="9" r="5" /><path d="m9 13-1 8 4-2 4 2-1-8M12 6v6m-3-3h6" /></>,
    other: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4m8-4v4M4 10h16m-8 3v4m-2-2h4" /></>
  };

  return <span className={`eventTypeMark ${kind} ${size}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg></span>;
}
