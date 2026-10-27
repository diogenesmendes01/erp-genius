"use client";

import { usePathname } from "next/navigation";
import { ErroArea, destinoDoErro } from "@/components/ErroArea";

export default function ErroAria({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const caminho = usePathname();
  return <ErroArea titulo="Não foi possível carregar o Agente de IA" reset={reset} voltar={{ href: destinoDoErro(caminho, "/aria") }} />;
}
