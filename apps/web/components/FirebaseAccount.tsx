"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
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
    </>}
    {message && <p className="settingHint" role="status">{message}</p>}
  </section>;
}
