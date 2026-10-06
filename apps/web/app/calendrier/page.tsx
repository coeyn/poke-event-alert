import { CalendarView } from "../../components/CalendarView";

export default function CalendarPage() {
  return <>
    <section className="pageIntro"><span className="eyebrow">Tes prochains rendez-vous</span><h1>Calendrier</h1><p>Retrouve les événements de tes boutiques favorites et découvre ceux qui se passent près de toi.</p></section>
    <CalendarView />
  </>;
}
