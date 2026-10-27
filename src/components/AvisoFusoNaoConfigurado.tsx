import Link from "next/link";
import { Aviso } from "./Aviso";

export const TEXTO_FUSO_NAO_CONFIGURADO = "Fuso da escola não configurado; horários exibidos em UTC.";
export const DESTINO_CONFIGURAR_FUSO = "/configuracao/operacao";

export function AvisoFusoNaoConfigurado({ className }: { className?: string }) {
  return <Aviso tom="atencao" className={className}>
    {TEXTO_FUSO_NAO_CONFIGURADO} <Link className="underline" href={DESTINO_CONFIGURAR_FUSO}>Configurar o fuso da escola</Link> (perfil de administração).
  </Aviso>;
}
