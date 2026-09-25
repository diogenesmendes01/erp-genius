import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarFilaContinuidadeMensal } from "@/server/matricula/continuidade-fila";
import { FilaContinuidadeMensal } from "./FilaContinuidadeMensal";
import { VoltarPara } from "@/components/VoltarPara";

export default async function FilaContinuidadeMensalPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const { cursor } = await searchParams;
  const resultado = await consultarFilaContinuidadeMensal({ cursor });
  if (!resultado.ok || !resultado.dado) {
    return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  }

  const { itens, proximoCursor } = resultado.dado;
  return <section className="space-y-4">
    <VoltarPara href="/financeiro" para="Financeiro" />
    <h1 className="text-2xl font-medium">Fila de continuidade mensal</h1>
    <p>Consulte as condições de cada matrícula antes de qualquer providência. Esta tela não emite cobranças nem atesta que o processamento recorrente esteja ativo.</p>
    <FilaContinuidadeMensal itens={itens} />
    {proximoCursor && <Link className="underline" href={`/financeiro/continuidade?cursor=${encodeURIComponent(proximoCursor)}`}>Próxima página</Link>}
    {cursor && <Link className="ml-4 underline" href="/financeiro/continuidade">Voltar ao início</Link>}
  </section>;
}
