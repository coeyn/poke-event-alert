import { LiveData } from "../../components/LiveData";

export default function MesBoutiquesPage() {
  return (
    <>
      <section className="pageIntro">
        <span className="eyebrow">Favoris</span>
        <h1>Mes boutiques suivies</h1>
        <p>Les Ligues que tu veux surveiller en priorité.</p>
      </section>
      <LiveData mode="favorites" />
    </>
  );
}
