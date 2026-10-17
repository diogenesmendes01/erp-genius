/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Build standalone p/ o Docker de producao (doc 31): copia so o necessario p/ rodar
  // (server.js + node_modules podados) — imagem final sem devDependencies.
  output: "standalone",
  serverExternalPackages: ["pdfkit", "fontkit"],
  // Saída de /leads (Fase 2, bloco J; C2 da R1 do #216): favoritos e links antigos caem no CRM novo.
  async redirects() {
    return [
      { source: "/leads", destination: "/funil", permanent: true },
      { source: "/leads/:id/contratacao", destination: "/oportunidades/:id/contratacao", permanent: true },
      { source: "/leads/:id", destination: "/funil?o=:id", permanent: true },
    ];
  },
  outputFileTracingIncludes: { "/api/matriculas/*/previas/*/pdf": ["./src/assets/fonts/*"], "/matriculas/*/contrato/previas/*": ["./src/assets/fonts/*"] },
};

export default nextConfig;
