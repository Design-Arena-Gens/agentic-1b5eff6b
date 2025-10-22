import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Caption Agent',
  description: 'Generate captions and thumbnails from text and photos, then email results automatically.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
