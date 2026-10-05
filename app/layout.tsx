import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sidequest',
  description: 'Každý den nový Sidequest.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}