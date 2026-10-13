"use client";

import { usePathname } from "next/navigation";
import { ErroArea, destinoDoErro } from "@/components/ErroArea";

// Erro da área, dentro do shell (docs/43 §6 item 10): título da área, "Tentar de novo" e volta ao índice
// dela — ao início, quando foi o próprio índice que falhou. Sem error.message nem digest na tela.
export default function ErroSecretaria({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const caminho = usePathname();
  return <ErroArea titulo="Não foi possível carregar a secretaria" reset={reset} voltar={{ href: destinoDoErro(caminho, "/secretaria") }} />;
}
