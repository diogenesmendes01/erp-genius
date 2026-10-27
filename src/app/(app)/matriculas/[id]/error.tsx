"use client";

import { useParams, usePathname } from "next/navigation";
import { ErroArea, destinoDoErro } from "@/components/ErroArea";

export default function ErroMatricula({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { id } = useParams<{ id: string }>();
  const caminho = usePathname();
  const hub = `/matriculas/${encodeURIComponent(id)}`;
  return <ErroArea titulo="Não foi possível carregar esta seção da matrícula" reset={reset} voltar={{ href: destinoDoErro(caminho, hub), para: "Matrícula" }} />;
}
