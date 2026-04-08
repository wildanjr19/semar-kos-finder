import "maplibre-gl/dist/maplibre-gl.css";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";

export const metadata = {
  title: "Find Your Kos!",
  description: "Peta kos sekitar UNS",
};

type RootLayoutProps = {
  children: ReactNode;
};

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="id">
      <body
        className={plusJakartaSans.variable}
        style={{
          margin: 0,
          fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif",
          backgroundColor: "#f5f7f2",
        }}
      >
        <style>{`
          .maplibregl-popup.kos-popup .maplibregl-popup-content {
            background: #f8fbf6;
            padding: 0;
            border-radius: 18px;
            box-shadow: 0 10px 24px rgba(47, 63, 57, 0.16);
          }

          .maplibregl-popup.kos-popup .maplibregl-popup-close-button {
            top: 10px;
            right: 10px;
            width: 24px;
            height: 24px;
            border-radius: 999px;
            border: 1px solid rgba(130, 154, 177, 0.45);
            background: #ffffff;
            color: #334155;
            font-size: 16px;
            line-height: 20px;
            transition: background-color 180ms ease, border-color 180ms ease;
          }

          .maplibregl-popup.kos-popup .maplibregl-popup-close-button:hover {
            background: #ffffff;
            border-color: rgba(130, 154, 177, 0.8);
          }

          .maplibregl-popup.kos-popup.maplibregl-popup-anchor-top .maplibregl-popup-tip {
            border-bottom-color: #c4d1bc;
          }

          .maplibregl-popup.kos-popup.maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
            border-top-color: #c4d1bc;
          }

          .maplibregl-popup.kos-popup.maplibregl-popup-anchor-left .maplibregl-popup-tip {
            border-right-color: #c4d1bc;
          }

          .maplibregl-popup.kos-popup.maplibregl-popup-anchor-right .maplibregl-popup-tip {
            border-left-color: #c4d1bc;
          }
        `}</style>
        {children}
      </body>
    </html>
  );
}
