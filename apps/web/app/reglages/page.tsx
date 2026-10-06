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
  pushStatus
} from "../../lib/push";
import { DEFAULT_SETTINGS, readLocalSettings, saveLocalSettings, type LocalSettings } from "../../lib/local-settings";
import { readBlockedVenues, setVenueBlocked, type BlockedVenue } from "../../lib/blocked-venues";

export default function ReglagesPage() {
  const [settings, setSettings] = useState<LocalSettings>(DEFAULT_SETTINGS);
  const [blockedVenues, setBlockedVenues] = useState<BlockedVenue[]>([]);
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [pushSupported, setPushSupported] = useState(true);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [locationBusy, setLocationBusy] = useState(false);

  useEffect(() => {
    setSettings(readLocalSettings());
    setBlockedVenues(readBlockedVenues());

    pushStatus()
      .then((status) => {
        setPushSupported(status.supported);
        setPushSubscribed(status.subscribed);
      })
      .catch(() => setPushSupported(false));
  }, []);

  function toggle(key: "challenge" | "cup" | "prerelease" | "other") {
    setSaved(false);
    setSettings((current) => ({ ...current, [key]: !current[key] }));
  }

  async function save() {
    saveLocalSettings(settings);
    setSaved(true);
    setSaveMessage("");

    if (PUBLIC_API_CONFIGURED) {
      try {
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
      } catch {
        setSaveMessage("Enregistré sur cet appareil. La synchronisation des alertes est momentanément indisponible.");
      }
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage("La position n'est pas disponible sur cet appareil.");
      return;
    }
    setLocationBusy(true);
    setLocationMessage("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setSettings((current) => ({
          ...current,
          location: { latitude: coords.latitude, longitude: coords.longitude }
        }));
        setSaved(false);
        setLocationBusy(false);
        setLocationMessage("Position obtenue. Enregistre tes préférences pour l'utiliser.");
      },
      () => {
        setLocationBusy(false);
        setLocationMessage("Position indisponible. Autorise la localisation dans ton navigateur et réessaie.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
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

  return (
    <>
      <header className="workspaceHead"><h1>Réglages</h1></header>

      <section className="settingsCard">
        <h2>Découvrir autour de moi</h2>
        <p className="settingHint">Le calendrier affiche toujours les événements de tes boutiques favorites. Ajoute aussi ceux d'autres boutiques dans un rayon autour de ta position.</p>
        <label className="rangeLabel" htmlFor="discovery-radius">Rayon de découverte <strong>{settings.discoveryRadiusKm === 0 ? "Désactivé" : `${settings.discoveryRadiusKm} km`}</strong></label>
        <input id="discovery-radius" className="rangeInput" type="range" min="0" max="200" step="10" value={settings.discoveryRadiusKm} onChange={(event) => { setSaved(false); setSettings((current) => ({ ...current, discoveryRadiusKm: Number(event.target.value) })); }} />
        <button className="secondaryButton" type="button" onClick={locate} disabled={locationBusy}>{locationBusy ? "Localisation…" : settings.location ? "Actualiser ma position" : "Utiliser ma position"}</button>
        {settings.location && <><button className="secondaryButton" type="button" onClick={() => { setSaved(false); setSettings((current) => ({ ...current, location: null, discoveryRadiusKm: 0 })); setLocationMessage("Position retirée. Enregistre tes préférences pour confirmer."); }}>Effacer ma position</button><p className="settingHint">Position enregistrée sur cet appareil uniquement.</p></>}
        {locationMessage && <p className="settingHint" role="status">{locationMessage}</p>}
      </section>

      <section className="settingsCard">
        <h2>Types d'événements</h2>
        <Setting label="League Challenge" checked={settings.challenge} onChange={() => toggle("challenge")} />
        <Setting label="League Cup" checked={settings.cup} onChange={() => toggle("cup")} />
        <Setting label="Avant-premières" checked={settings.prerelease} onChange={() => toggle("prerelease")} />
        <Setting label="Autres événements Play!" checked={settings.other} onChange={() => toggle("other")} />
      </section>

      <section className="settingsCard">
        <h2>Boutiques bloquées</h2>
        <p className="settingHint">Leurs événements n’apparaissent plus dans l’accueil, la recherche ni le calendrier. Cette liste est enregistrée sur cet appareil.</p>
        {blockedVenues.length ? <div className="blockedVenueList">{blockedVenues.map((venue) => <div className="blockedVenueRow" key={venue.key}><span><strong>{venue.name}</strong><small>{venue.city || "France"}</small></span><button type="button" className="secondaryButton" onClick={() => setBlockedVenues(setVenueBlocked(venue, false))} aria-label={`Débloquer ${venue.name}`}>Débloquer</button></div>)}</div> : <p className="settingHint">Aucune boutique bloquée.</p>}
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

            {pushMessage && <p>{pushMessage}</p>}
          </>
        )}
      </section>

      <button className="primaryButton" onClick={save}>
        {saved ? "✓ Enregistré" : "Enregistrer mes préférences"}
      </button>
      {saveMessage && <p className="settingHint" role="status">{saveMessage}</p>}
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
