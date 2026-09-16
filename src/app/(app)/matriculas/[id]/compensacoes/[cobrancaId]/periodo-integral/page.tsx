import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarRegularizacoesPeriodoIntegral } from "@/server/matricula/periodo-integral";
import { PeriodoIntegral } from "./PeriodoIntegral";

export default async function PeriodoIntegralPage({
  params,
}: {
  params: Promise<{ id: string; cobrancaId: string }>;
}) {
  await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const { id: matriculaId, cobrancaId } = await params;
  const resultado = await consultarRegularizacoesPeriodoIntegral({ matriculaId, cobrancaId });

  return <div className="space-y-4">
    <Link href={`/matriculas/${matriculaId}/compensacoes/${cobrancaId}`} className="underline">Voltar à apuração da mensalidade</Link>
    <h1 className="text-2xl">Regularização do período integral</h1>
    <p>Registre a escolha explícita do aluno para um período totalmente indisponível. Aprovar a proposta não aplica crédito, cobertura futura, cobrança ou ajuste financeiro.</p>
    {!resultado.ok || !resultado.dado ? <p role="alert">{resultado.ok ? "Consulta de regularização indisponível." : resultado.erro}</p> : <PeriodoIntegral matriculaId={matriculaId} cobrancaId={cobrancaId} dados={resultado.dado} />}
  </div>;
}
