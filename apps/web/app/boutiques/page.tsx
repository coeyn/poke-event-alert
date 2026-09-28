import { LiveData } from "../../components/LiveData";

export default function BoutiquesPage() {
  return (
    <>
      <section className="pageIntro">
        <span className="eyebrow">Découvrir</span>
        <h1>Trouve ta boutique</h1>
        <p>Recherche une boutique ou une Ligue et ajoute-la à tes favoris.</p>
      </section>
      <LiveData mode="venues" />
    </>
  );
}
