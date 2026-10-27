
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["pdfkit", "fontkit"],
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
