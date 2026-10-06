"use client";

import { useEffect, useState } from "react";
import {
  PUBLIC_API_CONFIGURED,
  getOrCreateUserId,
  savePreferences
} from "../../lib/api";
import {
  disablePushNotifications,
  enablePushNotifications,
  pushStatus,
  sendPushTest
} from "../../lib/push";

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
  const [pushSupported, setPushSupported] = useState(true);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");

  useEffect(() => {
    try {
      const value = localStorage.getItem(KEY);
      if (value) setSettings(JSON.parse(value) as Settings);
    } catch {}

    pushStatus()
      .then((status) => {
        setPushSupported(status.supported);
        setPushSubscribed(status.subscribed);
      })
      .catch(() => setPushSupported(false));
  }, []);

  function toggle(key: keyof Settings) {
    setSaved(false);
    setSettings((current) => ({ ...current, [key]: !current[key] }));
  }

  async function save() {
    localStorage.setItem(KEY, JSON.stringify(settings));

    if (PUBLIC_API_CONFIGURED) {
      const userId = await getOrCreateUserId();
      const eventTypes = (
        ["challenge", "cup", "prerelease", "other"] as const
      ).filter((type) => settings[type]);

      await savePreferences(userId, {
        eventTypes,
        newEventEnabled: true,
        eventUpdateEnabled: true,
        reminderEnabled: false,
        reminderHoursBefore: 24
      });
    }

    setSaved(true);
  }

  async function togglePush() {
    setPushBusy(true);
    setPushMessage("");

    try {
      if (pushSubscribed) {
        await disablePushNotifications();
        setPushSubscribed(false);
        setPushMessage("Notifications désactivées.");
      } else {
        await enablePushNotifications();
        setPushSubscribed(true);
        setPushMessage("Notifications activées.");
      }
    } catch (error) {
      setPushMessage(error instanceof Error ? error.message : "Erreur Push.");
    } finally {
      setPushBusy(false);
    }
  }

  async function testPush() {
    setPushBusy(true);
    setPushMessage("");

    try {
      const result = await sendPushTest();
      setPushMessage(
        `Notification de test envoyée (${result.sent}/${result.subscriptions}).`
      );
    } catch (error) {
      setPushMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer la notification de test."
      );
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <>
      <section className="pageIntro">
        <span className="eyebrow">Préférences</span>
        <h1>Mes alertes</h1>
        <p>Choisis les événements pour lesquels tu souhaites être prévenu.</p>
      </section>

      <section className="settingsCard">
        <h2>Types d'événements</h2>
        <Setting label="League Challenge" checked={settings.challenge} onChange={() => toggle("challenge")} />
        <Setting label="League Cup" checked={settings.cup} onChange={() => toggle("cup")} />
        <Setting label="Avant-premières" checked={settings.prerelease} onChange={() => toggle("prerelease")} />
        <Setting label="Autres événements Play!" checked={settings.other} onChange={() => toggle("other")} />
      </section>

      <section className="settingsCard mutedCard">
        <h2>Notifications Push</h2>

        {!PUBLIC_API_CONFIGURED ? (
          <p>Le moteur Push est prêt dans le projet. Il deviendra activable ici dès que l'API publique sera hébergée.</p>
        ) : !pushSupported ? (
          <p>Les notifications Push ne sont pas supportées par ce navigateur ou cet appareil.</p>
        ) : (
          <>
            <p>
              {pushSubscribed
                ? "Cet appareil est abonné aux alertes."
                : "Active les alertes pour les boutiques que tu suis."}
            </p>
            <button className="secondaryButton" onClick={togglePush} disabled={pushBusy}>
              {pushBusy
                ? "Traitement…"
                : pushSubscribed
                  ? "Désactiver les notifications"
                  : "Activer les notifications"}
            </button>

            {pushSubscribed && (
              <button className="secondaryButton" onClick={testPush} disabled={pushBusy}>
                Envoyer une notification de test
              </button>
            )}

            {pushMessage && <p>{pushMessage}</p>}
          </>
        )}
      </section>

      <button className="primaryButton" onClick={save}>
        {saved ? "✓ Enregistré" : "Enregistrer mes préférences"}
      </button>
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
