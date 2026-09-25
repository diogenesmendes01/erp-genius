import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPropostasUsoCredito } from "@/server/financeiro/uso-credito-proposta";
import { PropostaUsoCredito } from "./PropostaUsoCredito";
import { DevolucaoCredito } from "./DevolucaoCredito";
import { formatarMoeda } from "@/lib/dinheiro";
import { VoltarPara } from "@/components/VoltarPara";
export default async function Page({ params }: { params: Promise<{ id: string; creditoId: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const { id, creditoId } = await params, r = await consultarPropostasUsoCredito({ alunoId: id, creditoId });
  return <div className="space-y-4"><VoltarPara href={`/alunos/${id}`} para="Ficha do aluno" />
    <h1 className="text-2xl font-medium">Proposta de utilização de crédito</h1>
    <p>Identifique a cobrança e a concordância do aluno. A proposta não reserva saldo. Outra pessoa do Financeiro com permissão de aprovação ou da Administração confere e aplica o abatimento, preservando os recebimentos em dinheiro.</p>
    {!r.ok && <p role="alert">{r.erro}</p>}{r.ok && r.dado && <>
      {r.dado.origemDesistencia && <section className="rounded border p-4 space-y-2" aria-label="Origem do crédito">
        <h2 className="font-medium">Crédito de acerto de desistência</h2>
        <p>Valor original: {formatarMoeda(r.dado.origemDesistencia.valorOriginal, r.dado.moeda)}. O crédito foi apurado em acerto aprovado; isso não comprova devolução de dinheiro.</p>
        <p>Cobrança de origem: {r.dado.origemDesistencia.cobrancaId}</p>
        <p>Aplicação: {r.dado.origemDesistencia.aplicacaoId} · Decisão: {r.dado.origemDesistencia.decisaoId}</p>
        <Link className="underline" href={`/matriculas/${r.dado.matriculaId}/desistencia/financeiro`}>Consultar o acerto da matrícula</Link>
      </section>}
      <PropostaUsoCredito dados={r.dado} /><DevolucaoCredito dados={r.dado} /></>}
  </div>;
}
