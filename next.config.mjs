/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Build standalone p/ o Docker de producao (doc 31): copia so o necessario p/ rodar
  // (server.js + node_modules podados) — imagem final sem devDependencies.
  output: "standalone",
};

export default nextConfig;
