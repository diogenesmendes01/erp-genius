import { EsqueletoCartoes } from "@/components/Esqueleto";

// Diário de aulas (docs/42 /diario #3: "um loading.tsx com esqueleto de 3 cartões"): dentro do layout da
// área, que já desenha as abas — aqui o título, a busca e os cartões. Cobre a troca de aba e a paginação.
export default function LoadingDiario() {
  return <EsqueletoCartoes rotulo="diário de aulas" busca />;
}
