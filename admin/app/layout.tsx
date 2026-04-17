import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Admin Panel',
  description: 'Admin panel for Kos Finder',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}