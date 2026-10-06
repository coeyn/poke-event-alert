import Link from "next/link";
import { LiveData } from "../../components/LiveData";

export default function ExplorerPage() {
  return <>
    <header className="workspaceHead"><div><h1>Explorer</h1></div><Link className="textAction" href="/calendrier/">Calendrier <span aria-hidden="true">↗</span></Link></header>
    <LiveData mode="discover" />
  </>;
}
