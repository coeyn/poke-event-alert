"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Événements", icon: "◉" },
  { href: "/boutiques/", label: "Boutiques", icon: "⌕" },
  { href: "/mes-boutiques/", label: "Suivies", icon: "★" },
  { href: "/reglages/", label: "Réglages", icon: "⚙" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brandMark">P!</span>
          <span>
            <strong>Poké Event Alert</strong>
            <small>Ne rate plus ton prochain tournoi</small>
          </span>
        </Link>
        <span className="liveBadge">PREVIEW</span>
      </header>

      <main className="main">{children}</main>

      <nav className="bottomNav" aria-label="Navigation principale">
        {links.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href.replace(/\/$/, ""));
          return (
            <Link key={link.href} href={link.href} className={active ? "navItem active" : "navItem"}>
              <span className="navIcon">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
