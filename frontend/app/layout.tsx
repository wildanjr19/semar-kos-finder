import "maplibre-gl/dist/maplibre-gl.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Find Your Kos!",
  description: "Peta kos sekitar UNS",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="id">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
