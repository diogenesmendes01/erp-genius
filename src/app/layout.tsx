import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const roboto = localFont({
  src: [{ path: "./fonts/roboto-variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-sans",
  display: "swap",
});

const mono = localFont({
  src: [{ path: "./fonts/jetbrains-mono-latin-wght.woff2", weight: "400 600", style: "normal" }],
  variable: "--font-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "ERP Genius", template: "%s · ERP Genius" },
  description: "Gestão escolar da Escola Genius",
};

const temaScript = `(function(){try{var t=localStorage.getItem('tema');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${roboto.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
