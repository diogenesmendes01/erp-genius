"use client";

import { usePathname } from "next/navigation";
import { ErroArea, destinoDoErro } from "@/components/ErroArea";

// Erro da área, dentro do shell: título da área, "Tentar de novo" e volta ao início da área.
// Sem error.message nem digest na tela.
export default function ErroContatos({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const caminho = usePathname();
  return <ErroArea titulo="Não foi possível carregar os contatos" reset={reset} voltar={{ href: destinoDoErro(caminho, "/contatos") }} />;
}
