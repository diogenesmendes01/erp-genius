import { EsqueletoPublico } from "@/components/Esqueleto";

// /pagar/[token] (docs/43 §6 item 10): página pública, fora do shell — título e o cartão da cobrança.
export default function LoadingPagar() {
  return <EsqueletoPublico rotulo="pagamento" />;
}
