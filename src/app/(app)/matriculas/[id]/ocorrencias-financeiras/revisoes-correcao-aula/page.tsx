import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarRevisoesFinanceirasCorrecaoAula } from "@/server/financeiro/revisao-correcao-aula";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { RevisoesCorrecaoAula } from "./RevisoesCorrecaoAula";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO);
  const preferencia = await consultarPreferenciaFusoEquipe();
  const fusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const { id } = await params;
  const r = await consultarRevisoesFinanceirasCorrecaoAula({ matriculaId: id });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  return <main className="space-y-4">
    <Link className="underline" href={`/matriculas/${id}/ocorrencias-financeiras`}>Voltar às ocorrências financeiras</Link>
    <h1 className="text-2xl">Revisões financeiras de correção de aula</h1>
    <p>Esta etapa confirma a equivalência Q92 entre falta e presença já conferidas ou declara que a aula não devia ser cobrada. Nada muda aqui: o efeito financeiro calculado — reduzir a cobrança em aberto, gerar crédito quando a fatura está quitada, tirar a aula do próximo fechamento ou devolver ao saldo os minutos de horas pré-pagas — só acontece quando a gestão pedagógica publica a correção, na mesma operação.</p>
    <RevisoesCorrecaoAula matriculaId={id} dados={r.dado} fusoExibicao={fusoExibicao} />
  </main>;
}
