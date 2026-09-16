import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarRemarcacoesParticular } from "@/server/agenda/remarcacao-particular";
import { RemarcacaoParticular } from "./RemarcacaoParticular";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const { id } = await params, r = await consultarRemarcacoesParticular({ encontroOriginalId: id });
  return <div className="space-y-4"><Link href={`/diario/encontros/${id}/cancelamento`} className="underline">Voltar ao cancelamento</Link>
    <h1 className="text-2xl font-medium">Remarcar particular cancelada pela escola</h1>
    <p>A proposta mantém a duração original e exige escolha do aluno e aprovação de outra pessoa da gestão. Horas compradas precisam ter sua liberação aprovada pelo Financeiro. Publicar a remarcação não cria cobrança nem reserva essas horas automaticamente.</p>
    {!r.ok && <p role="alert">{r.erro}</p>}{r.ok && r.dado && <RemarcacaoParticular encontroOriginalId={id} dados={r.dado} />}
  </div>;
}
