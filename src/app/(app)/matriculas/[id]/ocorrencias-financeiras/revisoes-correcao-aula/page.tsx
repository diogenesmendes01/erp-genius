import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarRevisoesFinanceirasCorrecaoAula } from "@/server/financeiro/revisao-correcao-aula";
import { RevisoesCorrecaoAula } from "./RevisoesCorrecaoAula";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO);
  const { id } = await params;
  const r = await consultarRevisoesFinanceirasCorrecaoAula({ matriculaId: id });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  return <main className="space-y-4">
    <Link className="underline" href={`/matriculas/${id}/ocorrencias-financeiras`}>Voltar às ocorrências financeiras</Link>
    <h1 className="text-2xl">Revisões financeiras de correção de aula</h1>
    <p>Esta etapa só confirma a equivalência entre falta e presença já conferidas, pela regra de cobrança das <Link className="underline" href={`/matriculas/${id}/condicoes-horas`}>condições por hora</Link>. Não emite cobrança, não baixa pagamento e não cria crédito.</p>
    <RevisoesCorrecaoAula matriculaId={id} dados={r.dado} />
  </main>;
}
