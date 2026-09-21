import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCondicoesContinuidadeMensal } from "@/server/matricula/condicoes-continuidade-mensal";
import { consultarPreviaContinuidadeMensal } from "@/server/matricula/continuidade-previa";
import { CondicoesContinuidadeMensal } from "./CondicoesContinuidadeMensal";
import { PreviaContinuidadeMensal } from "./PreviaContinuidadeMensal";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO);
  const { id } = await params;
  const [resultado, previa] = await Promise.all([consultarCondicoesContinuidadeMensal(id), consultarPreviaContinuidadeMensal(id)]);
  return <div className="space-y-4">
    <Link href={`/matriculas/${id}/condicoes`} className="underline">Condições de entrada</Link>
    <h1 className="text-2xl">Condições de continuidade mensal</h1>
    <p>Registre as condições já contratadas para revisão independente. Este registro não emite cobrança, não renova o contrato e não altera cobranças existentes.</p>
    <Link href={`/matriculas/${id}/indisponibilidade-oferta`} className="underline">Relatar e acompanhar indisponibilidade da oferta</Link>
    {!resultado.ok && <p role="alert">{resultado.erro}</p>}
    {resultado.ok && resultado.dado && <CondicoesContinuidadeMensal dados={resultado.dado} />}
    <Link href={`/matriculas/${id}/disponibilidade-oferta`} className="block underline">Solicitar e acompanhar confirmação de oferta</Link>
    <PreviaContinuidadeMensal resultado={previa} />
  </div>;
}
