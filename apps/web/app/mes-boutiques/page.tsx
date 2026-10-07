import { FirebaseAccount } from "../../components/FirebaseAccount";
import { LiveData } from "../../components/LiveData";
import { CommunityAccount } from "../../components/CommunityAccount";

export default function MesBoutiquesPage() {
  return (
    <>
      <header className="workspaceHead"><h1>Compte</h1></header>
      <FirebaseAccount />
      <CommunityAccount />
      <section className="settingsCard">
        <h2>Boutiques suivies</h2>
        <p className="settingHint">Gère les boutiques dont tu veux retrouver les événements dans ton calendrier et recevoir les alertes.</p>
        <LiveData mode="favorites" showHeading={false} />
      </section>
    </>
  );
}
