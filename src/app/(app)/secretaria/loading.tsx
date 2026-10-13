import { EsqueletoCartoes } from "@/components/Esqueleto";

// Secretaria (docs/42 /secretaria #6: "secretaria/loading.tsx (esqueleto de 3 cards)"): sem layout de
// área — o título, a busca e os cartões das matrículas são da própria página.
export default function LoadingSecretaria() {
  return <EsqueletoCartoes rotulo="secretaria" busca />;
}
