import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>RenewalOps</h1>
      <p>Contract renewal management system</p>

      <div style={{ display: "grid", gap: "12px", marginTop: "24px" }}>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/contracts">Contracts</Link>
        <Link href="/clients">Clients</Link>
        <Link href="/team">Team</Link>
        <Link href="/settings">Settings</Link>
      </div>
    </main>
  );
}