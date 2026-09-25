import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarRegularizacoesPeriodoIntegral } from "@/server/matricula/periodo-integral";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { PeriodoIntegral } from "./PeriodoIntegral";
import { VoltarPara } from "@/components/VoltarPara";

export default async function PeriodoIntegralPage({
  params,
}: {
  params: Promise<{ id: string; cobrancaId: string }>;
}) {
  await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const { id: matriculaId, cobrancaId } = await params;
  const [resultado, preferencia] = await Promise.all([
    consultarRegularizacoesPeriodoIntegral({ matriculaId, cobrancaId }),
    consultarPreferenciaFusoEquipe(),
  ]);

  return <div className="space-y-4">
    <VoltarPara href={`/matriculas/${matriculaId}/compensacoes/${cobrancaId}`} para="Apuração da mensalidade" />
    <h1 className="text-2xl">Regularização do período integral</h1>
    <p>Registre a escolha explícita do aluno para um período totalmente indisponível. Aprovar a proposta não aplica crédito, cobertura futura, cobrança ou ajuste financeiro.</p>
    {!resultado.ok || !resultado.dado ? <p role="alert">{resultado.ok ? "Consulta de regularização indisponível." : resultado.erro}</p> : <PeriodoIntegral matriculaId={matriculaId} cobrancaId={cobrancaId} dados={resultado.dado} preferenciaFusoExibicao={preferencia.ok ? preferencia.dado?.fusoExibicao ?? null : null} />}
  </div>;
}
