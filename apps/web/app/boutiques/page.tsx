import { LiveData } from "../../components/LiveData";

export default function BoutiquesPage() {
  return (
    <>
      <header className="workspaceHead"><div><span className="eyebrow">Recherche</span><h1>Boutiques</h1></div></header>
      <LiveData mode="venues" />
    </>
  );
}
