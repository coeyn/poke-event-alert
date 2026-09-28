"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Events", icon: "◉" },
  { href: "/boutiques", label: "Boutiques", icon: "⌕" },
  { href: "/mes-boutiques", label: "Suivies", icon: "★" },
  { href: "/reglages", label: "Réglages", icon: "⚙" }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottomNav" aria-label="Navigation principale">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? "navItem active" : "navItem"}
          >
            <span className="navIcon" aria-hidden="true">
              {link.icon}
            </span>
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
