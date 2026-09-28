"use client";

import { useEffect, useState } from "react";

type Settings = {
  challenge: boolean;
  cup: boolean;
  prerelease: boolean;
  other: boolean;
};

const KEY = "poke-event-alert:preview-settings";

export default function ReglagesPage() {
  const [settings, setSettings] = useState<Settings>({
    challenge: true,
    cup: true,
    prerelease: true,
    other: true
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const value = localStorage.getItem(KEY);
      if (value) setSettings(JSON.parse(value) as Settings);
    } catch {}
  }, []);

  function toggle(key: keyof Settings) {
    setSaved(false);
    setSettings((current) => ({ ...current, [key]: !current[key] }));
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(settings));
    setSaved(true);
  }

  return (
    <>
      <section className="pageIntro">
        <span className="eyebrow">Préférences</span>
        <h1>Mes alertes</h1>
        <p>Choisis les événements pour lesquels tu souhaiteras être prévenu.</p>
      </section>

      <section className="settingsCard">
        <h2>Types d'événements</h2>
        <Setting label="League Challenge" checked={settings.challenge} onChange={() => toggle("challenge")} />
        <Setting label="League Cup" checked={settings.cup} onChange={() => toggle("cup")} />
        <Setting label="Avant-premières" checked={settings.prerelease} onChange={() => toggle("prerelease")} />
        <Setting label="Autres événements Play!" checked={settings.other} onChange={() => toggle("other")} />
      </section>

      <section className="settingsCard mutedCard">
        <h2>Notifications</h2>
        <p>Les notifications push seront activées quand le backend public sera déployé. La preview te permet déjà de tester la logique des favoris et préférences.</p>
      </section>

      <button className="primaryButton" onClick={save}>{saved ? "✓ Enregistré" : "Enregistrer mes préférences"}</button>
    </>
  );
}

function Setting({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="settingRow">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} />
    </label>
  );
}
