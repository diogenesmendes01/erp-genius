import { Papel } from "@prisma/client";
import { exigirSessaoPagina, temPapel } from "@/server/_shared";
import { consultarHistoricoCorrecaoAula } from "@/server/diario/correcao-aula";
import { CorrecaoAula } from "./CorrecaoAula";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";

export default async function CorrecaoAulaPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { id } = await params;
  const [revisao, preferencia] = await Promise.all([consultarHistoricoCorrecaoAula({ encontroId: id }), consultarPreferenciaFusoEquipe()]);

  return <main className="space-y-5">
    <VoltarPara href="/diario" />
    <header className="space-y-2">
      <h1 className="text-2xl font-medium">{revisao.ok && revisao.dado && !revisao.dado.podePropor ? "Histórico de correções da aula" : "Preparar correção da aula"}</h1>
      <p className="text-sm text-gray-700">As propostas preservam o diário vigente. Elas não publicam a correção, não alteram frequência e não confirmam nenhum resultado acadêmico.</p>
    </header>
    {!revisao.ok || !revisao.dado
      ? <p role="alert" className="text-red-700">{revisao.ok ? "Não foi possível carregar a chamada para correção." : revisao.erro}</p>
      : <CorrecaoAula key={`${revisao.dado.snapshot.diarioId}:${revisao.dado.estadoHash}:${revisao.dado.versaoAtual}`} encontroId={id} dados={revisao.dado} podeConferirImpactos={temPapel(usuario, Papel.GERENTE_PEDAGOGICO)} fusoExibicao={resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC")} />}
  </main>;
}
