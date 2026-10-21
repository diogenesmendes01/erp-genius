import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCondicoesHoras } from "@/server/matricula/condicoes-horas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { CondicoesHoras } from "./CondicoesHoras";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO);
  const { id } = await params;
  const [r, preferencia] = await Promise.all([consultarCondicoesHoras(id), consultarPreferenciaFusoEquipe()]);
  const preferenciaFusoExibicao = preferencia.ok ? preferencia.dado?.fusoExibicao ?? null : null;
  return <div className="space-y-4"><Link href={`/matriculas/${id}/condicoes`} className="underline">Condições de entrada</Link>
    <h1 className="text-2xl">Condições contratuais por hora</h1>
    <p>Transcreva as condições já aceitas. A aprovação confere a transcrição; não altera o contrato nem emite cobranças.</p>
    {!r.ok && <p role="alert">{r.erro}</p>}
    {r.ok && r.dado && <CondicoesHoras dados={r.dado} preferenciaFusoExibicao={preferenciaFusoExibicao} />}
  </div>;
}
