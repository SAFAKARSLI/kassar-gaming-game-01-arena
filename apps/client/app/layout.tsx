import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Arena Brawlers',
  description: 'Browser-based online multiplayer arena brawler (MVP)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
