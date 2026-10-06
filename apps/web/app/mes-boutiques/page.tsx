import { LiveData } from "../../components/LiveData";
import Link from "next/link";

export default function MesBoutiquesPage() {
  return (
    <>
      <header className="workspaceHead"><h1>Favoris</h1><Link className="textAction" href="/explorer/">Trouver une boutique <span aria-hidden="true">↗</span></Link></header>
      <LiveData mode="favorites" />
    </>
  );
}
