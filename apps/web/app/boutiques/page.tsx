import { LiveData } from "../../components/LiveData";

export default function BoutiquesPage() {
  return (
    <>
      <header className="workspaceHead"><h1>Boutiques</h1></header>
      <LiveData mode="venues" />
    </>
  );
}
