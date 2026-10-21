import { EsqueletoPublico } from "@/components/Esqueleto";

// /certificado/[codigo] (docs/43 §6 item 10): página pública, fora do shell — título e o cartão da validação.
export default function LoadingCertificado() {
  return <EsqueletoPublico rotulo="validação do certificado" />;
}
