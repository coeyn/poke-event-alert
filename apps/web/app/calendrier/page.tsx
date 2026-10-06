import { CalendarView } from "../../components/CalendarView";
import Link from "next/link";

export default function CalendarPage() {
  return <>
    <header className="workspaceHead"><h1>Calendrier</h1><Link className="textAction" href="/reglages/">Régler mon rayon <span aria-hidden="true">↗</span></Link></header>
    <CalendarView />
  </>;
}
