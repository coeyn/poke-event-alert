import {
  API_BASE_URL,
  PUBLIC_API_CONFIGURED,
  getOrCreateUserId
} from "./api";

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function pushBackendAvailable() {
  return PUBLIC_API_CONFIGURED;
}

export async function pushStatus() {
  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  if (!supported) {
    return {
      supported: false,
      configured: PUBLIC_API_CONFIGURED,
      permission: "default" as NotificationPermission,
      subscribed: false
    };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  return {
    supported: true,
    configured: PUBLIC_API_CONFIGURED,
    permission: Notification.permission,
    subscribed: Boolean(subscription)
  };
}

export async function enablePushNotifications() {
  if (!PUBLIC_API_CONFIGURED) {
    throw new Error("Le backend public n'est pas encore configuré.");
  }

  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    throw new Error("Les notifications Push ne sont pas supportées sur cet appareil.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Autorisation de notification refusée.");
  }

  const keyResponse = await fetch(`${API_BASE_URL}/push/public-key`);
  if (!keyResponse.ok) {
    throw new Error("Le serveur Push n'est pas encore configuré.");
  }

  const { publicKey } = (await keyResponse.json()) as { publicKey: string };
  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey)
    });
  }

  const json = subscription.toJSON();
  const userId = await getOrCreateUserId();

  const response = await fetch(
    `${API_BASE_URL}/users/${encodeURIComponent(userId)}/push-subscriptions`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: json.keys
      })
    }
  );

  if (!response.ok) {
    throw new Error("Impossible d'enregistrer l'abonnement Push.");
  }

  return true;
}

export async function disablePushNotifications() {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  if (PUBLIC_API_CONFIGURED) {
    const userId = await getOrCreateUserId();
    await fetch(
      `${API_BASE_URL}/users/${encodeURIComponent(userId)}/push-subscriptions`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      }
    );
  }

  await subscription.unsubscribe();
}
