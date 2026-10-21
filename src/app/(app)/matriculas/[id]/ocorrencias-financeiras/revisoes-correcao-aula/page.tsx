import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarRevisoesFinanceirasCorrecaoAula } from "@/server/financeiro/revisao-correcao-aula";
import { RevisoesCorrecaoAula } from "./RevisoesCorrecaoAula";
import { VoltarPara } from "@/components/VoltarPara";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO);
  const { id } = await params;
  const r = await consultarRevisoesFinanceirasCorrecaoAula({ matriculaId: id });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  return <main className="space-y-4">
    <VoltarPara href={`/matriculas/${id}/ocorrencias-financeiras`} para="Ocorrências financeiras" />
    <h1 className="text-2xl">Revisões financeiras de correção de aula</h1>
    <p>Esta etapa confirma a equivalência entre falta e presença já conferidas, pela regra de cobrança das <Link className="underline" href={`/matriculas/${id}/condicoes-horas`}>condições por hora</Link>. Também é aqui que o Financeiro declara que uma aula particular não devia ser cobrada. Nada muda nesta etapa: o efeito calculado — reduzir ou cancelar a cobrança em aberto, gerar crédito quando a fatura está quitada, tirar a aula do próximo fechamento ou devolver ao saldo os minutos de horas pré-pagas — só acontece quando a gestão pedagógica publica a correção, na mesma operação. A comissão não é recalculada.</p>
    <RevisoesCorrecaoAula matriculaId={id} dados={r.dado} />
  </main>;
}
