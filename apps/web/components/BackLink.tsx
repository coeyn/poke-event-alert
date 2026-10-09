"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

const PREVIOUS_PATH_KEY = "poke-event-alert:navigation-previous";

export function BackLink({
  fallback,
  children,
  className = "backLink"
}: {
  fallback: string;
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    const previousPath = sessionStorage.getItem(PREVIOUS_PATH_KEY);
    if (!previousPath || previousPath === pathname || window.history.length <= 1) return;

    event.preventDefault();
    router.back();
  }

  return <Link className={className} href={fallback} onClick={goBack}>{children}</Link>;
}
