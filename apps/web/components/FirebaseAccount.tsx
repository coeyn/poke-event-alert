"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User
} from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "../lib/firebase";
import { restoreFirebaseProfile } from "../lib/firebase-profile";

export function FirebaseAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"login" | "create">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!firebaseAuth) return;
    void getRedirectResult(firebaseAuth).catch((error: unknown) => {
      setMessage(authErrorMessage(error));
    });
    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        void restoreFirebaseProfile(nextUser)
          .then(() => setMessage("Tes favoris et préférences sont synchronisés avec ton compte."))
          .catch(() => setMessage("Connecté, mais la synchronisation Firestore a échoué. Vérifie les règles Firebase."));
      }
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseAuth) return;
    setBusy(true);
    setMessage("");
    try {
      if (mode === "create") await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      else await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      setPassword("");
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      setMessage(code.includes("email-already-in-use") ? "Cette adresse a déjà un compte. Connecte-toi." :
        code.includes("invalid-credential") || code.includes("user-not-found") ? "Adresse e-mail ou mot de passe incorrect." :
        code.includes("weak-password") ? "Choisis un mot de passe d’au moins 6 caractères." :
        error instanceof Error ? error.message : "Connexion impossible. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!firebaseAuth) return;
    setBusy(true);
    setMessage("");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      // GitHub Pages and Firebase Auth use different domains. On mobile,
      // redirect auth can lose its state when the browser blocks third-party
      // storage in Firebase's cross-origin helper iframe. Popup auth avoids it.
      await signInWithPopup(firebaseAuth, provider);
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!firebaseAuth) return;
    await signOut(firebaseAuth);
    setMessage("Déconnecté. Tes données restent enregistrées sur cet appareil.");
  }

  return <section className="settingsCard">
    <h2>Compte et synchronisation</h2>
    {!firebaseConfigured ? <p className="settingHint">Firebase n’est pas encore configuré. Ajoute les clés du projet dans <code>apps/web/.env.local</code> pour activer les comptes.</p> : user ? <>
      <p className="settingHint">Connecté avec <strong>{user.email}</strong>. Les boutiques suivies, bloquées et tes filtres sont synchronisés. Ta position reste sur cet appareil.</p>
      <button type="button" className="secondaryButton" onClick={() => void logout()}>Se déconnecter</button>
    </> : <>
      <div className="accountModes" role="group" aria-label="Action de compte">
        <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(""); }}>Connexion</button>
        <button type="button" className={mode === "create" ? "active" : ""} onClick={() => { setMode("create"); setMessage(""); }}>Créer un compte</button>
      </div>
      <form className="accountForm" onSubmit={(event) => void submit(event)}>
        <label>Adresse e-mail<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Mot de passe<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button type="submit" className="primaryButton" disabled={busy}>{busy ? "Patiente…" : mode === "login" ? "Se connecter" : "Créer mon compte"}</button>
      </form>
      <div className="accountDivider"><span>ou</span></div>
      <button type="button" className="googleAuthButton" onClick={() => void signInWithGoogle()} disabled={busy}>
        <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.7c3.9-3.6 6-8.8 6-14.9Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5c-1.9 1.3-4.2 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.9v5.1A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.8 28a12 12 0 0 1 0-7.7v-5.1H5.9a20 20 0 0 0 0 17.9l6.9-5.1Z"/><path fill="#EA4335" d="M24 12.1c3 0 5.6 1 7.7 3l5.8-5.8C34 5.9 29.5 4 24 4A20 20 0 0 0 5.9 15.2l6.9 5.1c1.6-4.7 6-8.2 11.2-8.2Z"/></svg>
        Continuer avec Google
      </button>
    </>}
    {message && <p className="settingHint" role="status">{message}</p>}
  </section>;
}

function authErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code.includes("unauthorized-domain")) return "Ce domaine n’est pas autorisé dans Firebase Authentication. Ajoute coeyn.github.io dans les domaines autorisés.";
  if (code.includes("popup-closed-by-user")) return "Connexion Google annulée.";
  if (code.includes("popup-blocked")) return "Le navigateur a bloqué la fenêtre Google. Autorise les fenêtres pop-up pour ce site, puis réessaie.";
  if (code.includes("web-storage-unsupported") || code.includes("operation-not-supported-in-this-environment")) return "La connexion Google n’est pas disponible dans ce navigateur intégré. Ouvre le site dans Chrome ou Safari, puis réessaie.";
  if (code.includes("network-request-failed")) return "La connexion a échoué à cause du réseau. Vérifie ta connexion, puis réessaie.";
  if (code.includes("account-exists-with-different-credential")) return "Un compte existe déjà avec cette adresse. Connecte-toi d’abord avec ton autre méthode.";
  if (code.includes("operation-not-allowed")) return "Active la connexion Google dans Firebase Authentication.";
  return error instanceof Error ? error.message : "Connexion Google impossible. Réessaie.";
}
