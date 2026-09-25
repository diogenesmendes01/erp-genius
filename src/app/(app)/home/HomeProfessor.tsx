"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkinExperimental } from "@/server/comercial/acoes";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";

interface Turma {
  id: string;
  label: string;
  diasHorario: string | null;
  alunos: number;
}
interface Experimental {
  id: string;
  nome: string;
  data: string;
  /** B9 (doc 32): aula já passou (além da tolerância) sem check-in — cobrar já. */
  vencida?: boolean;
}

export function HomeProfessor({
  nome,
  turmas,
  experimentais,
  proximaExperimental,
  preferenciaFusoExibicao,
}: {
  nome: string;
  turmas: Turma[];
  experimentais: Experimental[];
  proximaExperimental: Experimental | null;
  preferenciaFusoExibicao: string | null;
}) {
  const router = useRouter();
  // checkinExperimental não recebe chave de idempotência e recusa a repetição — depois do 1º check-in
  // a etapa deixa de ser "agendada" (server/comercial/acoes.ts:593, :603): resultado incerto manda
  // conferir antes de repetir. O erro aparece sob a linha da experimental que o disparou.
  const acao = useAcaoCliente({ idempotente: false });
  const [alvo, setAlvo] = useState<string | null>(null);

  async function checkin(id: string, compareceu: boolean) {
    setAlvo(id);
    const d = await acao.executar(() => checkinExperimental(id, compareceu));
    if (d?.tipo === "ok") router.refresh();
  }

  const data = (valor: string) => formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
  // A seleção vem do servidor. Não recalcule a partir dos check-ins exibidos: uma lista
  // pode conter apenas pendências passadas, sem próxima aula disponível.
  const proxima = proximaExperimental && !proximaExperimental.vencida ? proximaExperimental : null;
  const vencidas = experimentais.filter((e) => e.vencida).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium">Olá, {nome.split(" ")[0]}</h1>

      {vencidas > 0 && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <strong>{vencidas}</strong> experimental(is) com <strong>check-in vencido</strong> — registre
          Compareceu/Faltou: sem o check-in a recuperação de no-show não acontece.
        </p>
      )}

      {proxima && (
        <section className="rounded-lg border border-brand-200 bg-brand-50 p-4">
          <div className="text-xs font-medium text-brand-700">Próxima aula experimental</div>
          <div className="mt-1 text-lg font-medium text-gray-800">
            {data(proxima.data).texto} ({data(proxima.data).fuso}; origem UTC) · {proxima.nome}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 font-medium">Experimentais para check-in</h2>
        {experimentais.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma experimental agendada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {experimentais.map((e) => (
              <Fragment key={e.id}>
              <li
                className={
                  "flex items-center justify-between rounded-md px-3 py-2 " +
                  (e.vencida ? "border border-red-200 bg-red-50" : "bg-gray-50")
                }
              >
                <div className="text-sm">
                  <span className="font-medium text-gray-800">{e.nome}</span>
                  <span className="ml-2 text-gray-500">
                    {data(e.data).texto} ({data(e.data).fuso}; origem UTC)
                  </span>
                  {e.vencida && (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Check-in vencido
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => checkin(e.id, true)}
                    disabled={acao.ocupado}
                    className={botaoClasses({ tamanho: "sm" })}
                  >
                    Compareceu
                  </button>
                  <button
                    onClick={() => checkin(e.id, false)}
                    disabled={acao.ocupado}
                    className={botaoClasses({ variante: "secundario", tamanho: "sm" })}
                  >
                    Faltou
                  </button>
                </div>
              </li>
              {alvo === e.id && acao.erro && <li><FeedbackAcao erro={acao.erro} /></li>}
              </Fragment>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 font-medium">Minhas turmas</h2>
        {turmas.length === 0 ? (
          <p className="text-sm text-gray-400">Você não tem turmas atribuídas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {turmas.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                <Link href={`/alunos/turma/${t.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                  {t.label}
                </Link>
                <span className="text-xs text-gray-500">{t.diasHorario ?? "Horário a definir"} · {t.alunos} alunos</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
