import { LiveData } from "../components/LiveData";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">Événements près de chez toi</span>
          <h1>Ne rate plus ton prochain tournoi.</h1>
          <p>Challenges, Cups, avant-premières et événements Play! Pokémon réunis au même endroit.</p>
        </div>
      </section>
      <LiveData mode="events" />
    </>
  );
}
