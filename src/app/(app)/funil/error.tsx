"use client";

import { usePathname } from "next/navigation";
import { ErroArea, destinoDoErro } from "@/components/ErroArea";

export default function ErroFunil({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const caminho = usePathname();
  return <ErroArea titulo="Não foi possível carregar o funil" reset={reset} voltar={{ href: destinoDoErro(caminho, "/funil") }} />;
}
