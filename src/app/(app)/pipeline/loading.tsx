import { EsqueletoColunas } from "@/components/Esqueleto";
import { COLUNAS } from "./colunas";

export default function LoadingPipeline() {
  return <EsqueletoColunas rotulo="funil de leads" colunas={COLUNAS.length} />;
}
