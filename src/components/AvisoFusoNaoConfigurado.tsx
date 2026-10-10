import Link from "next/link";

// Aviso explícito no lugar do fallback silencioso para UTC (docs/43 §6 item 6; docs/42 L939): quando a escola
// ainda não configurou o fuso oficial, as telas continuam calculando em UTC — o cálculo não muda —, mas dizem
// isso na tela e levam a quem pode configurar. A configuração fica em /configuracao/operacao (administração).
export const TEXTO_FUSO_NAO_CONFIGURADO = "Fuso da escola não configurado; horários exibidos em UTC.";
export const DESTINO_CONFIGURAR_FUSO = "/configuracao/operacao";

export function AvisoFusoNaoConfigurado({ className = "rounded-md bg-amber-50 p-3 text-sm text-amber-800" }: { className?: string }) {
  return <p className={className}>
    {TEXTO_FUSO_NAO_CONFIGURADO} <Link className="underline" href={DESTINO_CONFIGURAR_FUSO}>Configurar o fuso da escola</Link> (perfil de administração).
  </p>;
}
