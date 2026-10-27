"use client";

import { usePathname } from "next/navigation";
import { ErroArea, destinoDoErro } from "@/components/ErroArea";

export default function ErroCarteira({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const caminho = usePathname();
  return <ErroArea titulo="Não foi possível carregar a carteira" reset={reset} voltar={{ href: destinoDoErro(caminho, "/carteira") }} />;
}
