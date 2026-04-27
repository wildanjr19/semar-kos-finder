"use client";

import dynamic from "next/dynamic";

const KosMap = dynamic(() => import("../components/Map"), {
  ssr: false,
  loading: () => (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        margin: 0,
        background: "#f5f7f2",
        color: "#334155",
        fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif",
      }}
    >
      <p style={{ margin: 0 }}>Memuat peta UNSKosFinder...</p>
    </main>
  ),
});

export default function Home() {
  return <KosMap />;
}