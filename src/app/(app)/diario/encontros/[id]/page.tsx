import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarChamadaEncontro } from "@/server/diario/chamada-encontro";
import { ChamadaEncontro } from "./ChamadaEncontro";
import { SolicitarExcecao } from "./SolicitarExcecao";
import { PublicarGravacao } from "./PublicarGravacao";
import { consultarOcorrenciasParticular } from "@/server/matricula/ocorrencia-particular";
import { OcorrenciaParticular } from "./OcorrenciaParticular";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";

export default async function ChamadaPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { id } = await params;
  const [r, ocorrencias, preferencia] = await Promise.all([listarChamadaEncontro({ encontroId: id }), consultarOcorrenciasParticular({ encontroId: id }), consultarPreferenciaFusoEquipe()]);
  return <div className="space-y-4">
    <VoltarPara href="/diario/encontros" para="Encontros" />
    <h1 className="text-2xl font-medium">Diário do encontro</h1>
    {!r.ok && <p role={ocorrencias.ok && ocorrencias.dado ? undefined : "alert"} className={ocorrencias.ok && ocorrencias.dado ? "text-gray-600" : "text-red-700"}>{r.erro}</p>}
    {r.ok && r.dado && <>
      <p>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, r.dado.fusoOrigem) }).format(new Date(r.dado.ocorridaEm))} · origem {r.dado.fusoOrigem}</p>
      {r.dado.exigeConferencia ? <p role="alert">Há vínculos que precisam de conferência da gestão antes do lançamento.</p>
        : r.dado.alunos.length === 0 ? <p>Nenhum aluno elegível identificado para esta chamada.</p>
        : <ChamadaEncontro key={r.dado.estadoAnterior ?? "novo"} dados={r.dado} />}
      {r.dado.diarioId && !r.dado.exigeConferencia && <>
        <PublicarGravacao encontroId={id} />
        <SolicitarExcecao encontroId={id} />
      </>}
    </>}
    {ocorrencias.ok && ocorrencias.dado && <OcorrenciaParticular dados={ocorrencias.dado} fusoExibicao={resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, ocorrencias.dado.fuso)} />}
  </div>;
}
