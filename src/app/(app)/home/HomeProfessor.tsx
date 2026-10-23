"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkinExperimental } from "@/server/comercial/acoes";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";

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
  // checkinExperimental é idempotente por natureza (#166, 5º lote): o mesmo check-in, já registrado por quem
  // repete, devolve ok sem gravar de novo (server/comercial/acoes.ts). O erro aparece sob a linha da experimental.
  const acao = useAcaoCliente({ idempotente: true });
  const [alvo, setAlvo] = useState<string | null>(null);

  async function compareceu(id: string) {
    setAlvo(id);
    const d = await acao.executar(() => checkinExperimental(id, true));
    if (d?.tipo === "ok") router.refresh();
  }

  // "Faltou" grava no-show e dispara a recuperação de no-show, sem desfazer nem correção pela tela: o
  // check-in só vale para experimental agendada (docs/42 L2693). O botão só abre a confirmação com o nome
  // do lead e a data da aula; a action roda no ConfirmarAcao, que mostra a falha dentro dele.
  const [faltou, setFaltou] = useState<Experimental | null>(null);
  function pedirFalta(e: Experimental) {
    setAlvo(e.id);
    acao.limpar();
    setFaltou(e);
  }
  function faltaRegistrada() {
    setFaltou(null);
    router.refresh();
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
          <EstadoVazio>Nenhuma experimental agendada.</EstadoVazio>
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
                    onClick={() => compareceu(e.id)}
                    disabled={acao.ocupado || faltou !== null}
                    className={botaoClasses({ tamanho: "sm" })}
                  >
                    Compareceu
                  </button>
                  <button
                    onClick={() => pedirFalta(e)}
                    disabled={acao.ocupado || faltou !== null}
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

      {faltou && (
        <ConfirmarAcao
          titulo={`Marcar ${faltou.nome} como faltou?`}
          confirmacao="falta"
          idempotente
          acao={() => checkinExperimental(faltou.id, false)}
          aoConcluir={faltaRegistrada}
          aoCancelar={() => setFaltou(null)}
        >
          <p>
            Aula experimental de {data(faltou.data).texto} ({data(faltou.data).fuso}; origem UTC). O lead passa a{" "}
            <strong>não compareceu</strong> e entra na recuperação de no-show: com a régua comercial ativa, ele recebe
            mensagens de remarcação pelo WhatsApp a partir de 30 minutos depois da aula.
          </p>
          <p>Não há desfazer pela tela: depois da falta, o check-in desta experimental não aceita correção aqui.</p>
        </ConfirmarAcao>
      )}

      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 font-medium">Minhas turmas</h2>
        {turmas.length === 0 ? (
          <EstadoVazio>Você não tem turmas atribuídas.</EstadoVazio>
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
