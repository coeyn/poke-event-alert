"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Accueil", icon: "home" },
  { href: "/explorer/", label: "Explorer", icon: "search" },
  { href: "/calendrier/", label: "Calendrier", icon: "calendar" },
  { href: "/mes-boutiques/", label: "Compte", icon: "account" },
  { href: "/reglages/", label: "Réglages", icon: "settings" }
];

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 10h17M8 14h2M14 14h2M8 18h2" /></>,
    star: <path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.5l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9L12 3Z" />,
    account: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M10 2.8h4l.6 2.1 1.8 1 2.1-.6 2 3.5-1.5 1.6v2l1.5 1.6-2 3.5-2.1-.6-1.8 1-.6 2.1h-4l-.6-2.1-1.8-1-2.1.6-2-3.5L5 13.4v-2L3.5 9.8l2-3.5 2.1.6 1.8-1 .6-2.1Z" /></>
  };
  return <svg className="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="appFrame">
      <nav className="bottomNav" aria-label="Navigation principale">
        {links.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href.replace(/\/$/, ""));
          return (
            <Link key={link.href} href={link.href} className={active ? "navItem active" : "navItem"} aria-current={active ? "page" : undefined}>
              <NavIcon name={link.icon} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
      <main className="main">{children}</main>
      <footer className="appFooter">Projet communautaire indépendant, sans affiliation avec The Pokémon Company International. Vérifie les détails auprès de la boutique ou de la source officielle.</footer>
    </div>
  );
}
