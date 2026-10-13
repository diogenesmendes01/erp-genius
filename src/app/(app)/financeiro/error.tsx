"use client";

import { usePathname } from "next/navigation";
import { ErroArea } from "@/components/ErroArea";
import { ROTULO_ABA } from "./abas";

// Erro do financeiro (docs/42 /financeiro #7 e L2031; docs/43 §6 item 10). Fica acima do layout de
// (painel): segura também a falha do próprio painel (título, atalhos e abas). Volta: das telas avulsas
// (acertos, recebimentos, migração…) ao Financeiro; do painel e das abas — que são o próprio
// Financeiro — ao início. Sem error.message nem digest na tela.
const ABAS = new Set(Object.keys(ROTULO_ABA));

function voltaDoErroFinanceiro(caminho: string): string {
  const [, area, aba, ...resto] = caminho.split(/[?#]/)[0].replace(/\/+$/, "").split("/");
  const noPainel = area === "financeiro" && resto.length === 0 && (aba === undefined || ABAS.has(aba));
  return noPainel ? "/home" : "/financeiro";
}

export default function ErroFinanceiro({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const caminho = usePathname();
  return <ErroArea titulo="Não foi possível carregar o financeiro" reset={reset} voltar={{ href: voltaDoErroFinanceiro(caminho) }} />;
}
