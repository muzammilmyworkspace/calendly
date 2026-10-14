import type { Metadata } from 'next';
// The two typefaces of the MAIN CHARACTER website, shipped inside the app (fontsource).
// Not next/font/google: that downloads from Google during the build, and on Vercel's build machines the
// download can fail — Next 16 then stops with "next/font/google queries have exactly one entry".
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import '@fontsource-variable/inter';
import './globals.css';

export const metadata: Metadata = {
  title: 'Plan een gesprek — MAIN CHARACTER',
  description: 'Plan een gesprek met Onyema Onwuka — MAIN CHARACTER.',
  icons: { icon: '/favicon.png', apple: '/favicon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
