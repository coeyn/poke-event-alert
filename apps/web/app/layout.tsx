import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "../components/AppShell";
import { ServiceWorkerRegister } from "../components/ServiceWorkerRegister";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Poké Event Alert",
  description: "Ne rate plus ton prochain événement Play! Pokémon.",
  manifest: `${basePath}/manifest.webmanifest`
};

export const viewport: Viewport = { themeColor: "#f5f7fb" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <ServiceWorkerRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
