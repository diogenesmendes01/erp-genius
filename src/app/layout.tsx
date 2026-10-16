import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Design system (docs/18 §Tipografia): Roboto variável (100–900); a UI usa os pesos 400, 500 e 600.
const roboto = localFont({
  src: [{ path: "./fonts/roboto-variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  // Cada tela pode dar o próprio título (ex.: "M-000123 · Ana Silva · ERP Genius"); sem título, fica "ERP Genius".
  title: { default: "ERP Genius", template: "%s · ERP Genius" },
  description: "Gestão escolar da Escola Genius",
};

// Aplica o tema antes do paint (sem flash): localStorage 'tema' ou preferência do sistema.
const temaScript = `(function(){try{var t=localStorage.getItem('tema');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={roboto.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
