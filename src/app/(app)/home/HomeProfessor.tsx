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
import { Avatar } from "@/components/Avatar";
import { BadgeEstado } from "@/components/BadgeEstado";

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
  const acao = useAcaoCliente({ idempotente: true });
  const [alvo, setAlvo] = useState<string | null>(null);

  async function compareceu(id: string) {
    setAlvo(id);
    const d = await acao.executar(() => checkinExperimental(id, true));
    if (d?.tipo === "ok") router.refresh();
  }

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
  const proxima = proximaExperimental && !proximaExperimental.vencida ? proximaExperimental : null;
  const vencidas = experimentais.filter((e) => e.vencida).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium">Olá, {nome.split(" ")[0]}</h1>

      {vencidas > 0 && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-surface p-4 text-sm text-gray-700">
          <BadgeEstado tom="atraso" className="font-mono tabular-nums">{vencidas}</BadgeEstado>
          experimental(is) com <strong>check-in vencido</strong> — registre
          Compareceu/Faltou: sem o check-in a recuperação de no-show não acontece.
        </p>
      )}

      {proxima && (
        <section className="rounded-xl border border-gray-200 bg-surface p-4">
          <BadgeEstado tom="brand">Próxima aula experimental</BadgeEstado>
          <div className="mt-1 text-lg font-medium text-gray-900">
            {data(proxima.data).texto} ({data(proxima.data).fuso}; origem UTC) · {proxima.nome}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 font-medium">Experimentais para check-in</h2>
        {experimentais.length === 0 ? (
          <EstadoVazio>Nenhuma experimental agendada.</EstadoVazio>
        ) : (
          <ul className="flex flex-col gap-2">
            {experimentais.map((e) => (
              <Fragment key={e.id}>
              <li className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2">
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <Avatar nome={e.nome} tamanho={32} />
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900">{e.nome}</span>
                    <span className="ml-2 text-gray-500">
                      {data(e.data).texto} ({data(e.data).fuso}; origem UTC)
                    </span>
                    {e.vencida && (
                      <span className="ml-2"><BadgeEstado tom="atraso">Check-in vencido</BadgeEstado></span>
                    )}
                  </div>
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

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 font-medium">Minhas turmas</h2>
        {turmas.length === 0 ? (
          <EstadoVazio>Você não tem turmas atribuídas.</EstadoVazio>
        ) : (
          <ul className="flex flex-col gap-2">
            {turmas.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2">
                <Link href={`/alunos/turma/${t.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                  {t.label}
                </Link>
                <span className="flex items-center gap-2 text-xs text-gray-500">
                  {t.diasHorario ?? <BadgeEstado tom="aviso">Horário a definir</BadgeEstado>}
                  <BadgeEstado tom="neutro" className="font-mono tabular-nums">{t.alunos}</BadgeEstado>
                  alunos
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
