import { EsqueletoCartoes } from "@/components/Esqueleto";

// Acadêmico (docs/43 §6 item 10): dentro do layout da área, que já desenha as abas — aqui o título, a
// linha de apoio, os filtros e as solicitações em cartões. Cobre a troca entre abas irmãs, que o
// (app)/loading.tsx não cobre (o layout da área fica montado).
export default function LoadingAcademico() {
  return <EsqueletoCartoes rotulo="acadêmico" busca />;
}
