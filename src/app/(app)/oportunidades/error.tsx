"use client";

import { usePathname } from "next/navigation";
import { ErroArea, destinoDoErro } from "@/components/ErroArea";

// Erro da área, dentro do shell: título da área, "Tentar de novo" e volta ao funil (onde a oportunidade
// abre em painel). Sem error.message nem digest na tela.
export default function ErroOportunidades({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const caminho = usePathname();
  return <ErroArea titulo="Não foi possível carregar a oportunidade" reset={reset} voltar={{ href: destinoDoErro(caminho, "/funil") }} />;
}
