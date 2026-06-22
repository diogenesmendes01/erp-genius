import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const anthropicSans = localFont({
  src: [
    { path: "./fonts/AnthropicSans-Text-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/AnthropicSans-Text-Medium.otf", weight: "500", style: "normal" },
    { path: "./fonts/AnthropicSans-Text-Semibold.otf", weight: "600", style: "normal" },
    { path: "./fonts/AnthropicSans-Text-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ERP Genius",
  description: "Gestão escolar da Escola Genius",
};

// Aplica o tema antes do paint (sem flash): localStorage 'tema' ou preferência do sistema.
const temaScript = `(function(){try{var t=localStorage.getItem('tema');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={anthropicSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
