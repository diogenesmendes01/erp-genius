"use client";

import { usePathname } from "next/navigation";
import { ErroArea } from "@/components/ErroArea";

// Erro da Configuração (docs/42 /configuracao #1: "error.tsx com tentar novamente em configuracao/").
// Fica dentro do layout: o h1 "Configuração" e as sub-abas continuam na tela, por isso o título do erro
// é h2. Volta: de uma tela interna (lote de migração, modelo contratual…) à Configuração; de uma
// sub-aba — que já é o índice, e as outras abas seguem acima — ao início. Sem error.message nem digest.
function voltaDoErroConfiguracao(caminho: string): string {
  const segmentos = caminho.split(/[?#]/)[0].split("/").filter(Boolean);
  return segmentos.length <= 2 ? "/home" : "/configuracao";
}

export default function ErroConfiguracao({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const caminho = usePathname();
  return <ErroArea titulo="Não foi possível carregar esta configuração" reset={reset} voltar={{ href: voltaDoErroConfiguracao(caminho) }} nivel={2} />;
}
