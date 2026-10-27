"use client";

import { usePathname } from "next/navigation";
import { ErroArea } from "@/components/ErroArea";

function voltaDoErroConfiguracao(caminho: string): string {
  const segmentos = caminho.split(/[?#]/)[0].split("/").filter(Boolean);
  return segmentos.length <= 2 ? "/home" : "/configuracao";
}

export default function ErroConfiguracao({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const caminho = usePathname();
  return <ErroArea titulo="Não foi possível carregar esta configuração" reset={reset} voltar={{ href: voltaDoErroConfiguracao(caminho) }} nivel={2} />;
}
