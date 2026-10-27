"use client";

import { usePathname } from "next/navigation";
import { ErroArea, destinoDoErro } from "@/components/ErroArea";

export default function ErroContatos({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const caminho = usePathname();
  return <ErroArea titulo="Não foi possível carregar os contatos" reset={reset} voltar={{ href: destinoDoErro(caminho, "/contatos") }} />;
}
