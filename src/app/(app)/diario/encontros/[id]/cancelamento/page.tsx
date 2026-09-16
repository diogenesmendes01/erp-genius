import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina, temPapel } from "@/server/_shared";
import { consultarCancelamentoParticular } from "@/server/agenda/cancelamento-particular";
import { CancelamentoParticular } from "./CancelamentoParticular";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO, Papel.SECRETARIA_ACADEMICA);
  const { id } = await params;
  const r = await consultarCancelamentoParticular({ encontroId: id });
  return <div className="space-y-4">
    <Link href="/diario/encontros" className="underline">Voltar aos encontros</Link>
    <h1 className="text-2xl font-medium">Cancelamento de particular</h1>
    {r.ok && r.dado?.status === "CANCELADO" && (temPapel(usuario, Papel.SECRETARIA_ACADEMICA) || temPapel(usuario, Papel.GERENTE_PEDAGOGICO)) && <Link href={`/diario/encontros/${id}/remarcacao`} className="block underline">Propor ou acompanhar remarcação</Link>}
    <p>A gestão pedagógica ou Administração decide a solicitação de outra pessoa. A aprovação cancela o encontro na agenda.</p>
    <p>Quando a escola cancela, remarcação ou crédito dependem da escolha do aluno e do ajuste autorizado. No painel de compras da matrícula, o Financeiro propõe liberar as horas para remarcação ou convertê-las em crédito, com aprovação de outra pessoa. Cancelar a agenda não libera saldo nem altera cobranças ou recebimentos por si só. Crédito apurado não significa devolução executada.</p>
    {!r.ok && <p role="alert">{r.erro}</p>}
    {r.ok && r.dado && <CancelamentoParticular encontroId={id} dados={r.dado} />}
  </div>;
}

