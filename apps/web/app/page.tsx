import { LiveData } from "../components/LiveData";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">Tous les événements Play! Pokémon</span>
          <h1>Le prochain tournoi commence ici.</h1>
          <p>Explore les événements, trouve tes boutiques et suis celles qui comptent pour toi.</p>
        </div>
      </section>
      <LiveData mode="discover" />
    </>
  );
}
