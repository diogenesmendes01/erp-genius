import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPropostasUsoCredito } from "@/server/financeiro/uso-credito-proposta";
import { PropostaUsoCredito } from "./PropostaUsoCredito";
export default async function Page({ params }: { params: Promise<{ id: string; creditoId: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO);
  const { id, creditoId } = await params, r = await consultarPropostasUsoCredito({ alunoId: id, creditoId });
  return <div className="space-y-4"><Link className="underline" href={`/alunos/${id}`}>Voltar à ficha do aluno</Link>
    <h1 className="text-2xl font-medium">Proposta de utilização de crédito</h1>
    <p>Identifique a cobrança e a concordância do aluno. A proposta não reserva saldo. Outra pessoa do Financeiro com permissão de aprovação ou da Administração confere e aplica o abatimento, preservando os recebimentos em dinheiro.</p>
    {!r.ok && <p role="alert">{r.erro}</p>}{r.ok && r.dado && <PropostaUsoCredito dados={r.dado} />}
  </div>;
}
