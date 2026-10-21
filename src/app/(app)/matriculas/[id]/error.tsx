"use client";

import { useParams, usePathname } from "next/navigation";
import { ErroArea, destinoDoErro } from "@/components/ErroArea";

// Erro das seções da matrícula (docs/42 /matriculas/[id]/desistencia #2: "error.tsx com reset() e link
// para a matrícula"). Fica dentro do layout de [id]: o cabeçalho (código · aluno · estado) e as abas
// das seções continuam na tela. Volta ao hub da matrícula — ou ao início, quando foi o hub que falhou: o
// Financeiro e a Gerência pedagógica abrem o hub, mas não a Secretaria (C1 da R1 da #174). Sem error.message nem digest.
export default function ErroMatricula({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { id } = useParams<{ id: string }>();
  const caminho = usePathname();
  const hub = `/matriculas/${encodeURIComponent(id)}`;
  return <ErroArea titulo="Não foi possível carregar esta seção da matrícula" reset={reset} voltar={{ href: destinoDoErro(caminho, hub), para: "Matrícula" }} />;
}
