"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { PRIORIDADE_TAREFA_LABEL, STATUS_MENSAGEM_AGENDADA_LABEL, TIPO_TAREFA_LABEL } from "@/lib/labels";
import type { Resultado } from "@/server/_shared/resultado";
import { concluirTarefa } from "@/server/crm/tarefas-acoes";
import type { ItemAgenda } from "@/server/crm/mensagens-agendadas";
import {
  ORDEM_GRUPOS, ROTULO_GRUPO, acoesLote, chaveItem, dataCivilDoItem, dataCurta, grupoDoItem, hrefTarefas, instanteDoItem, textoHora,
  type ParamsTarefas,
} from "./visao";

type Props = {
  itens: ItemAgenda[];
  /** Instante de referência (ISO) para atrasada/hoje; o servidor decide. */
  agora: string;
  fusoEscola: string;
  fusoExibicao: string;
  /** Parâmetros atuais da URL, preservados nos links de abrir. */
  params?: ParamsTarefas;
};

export function ListaTarefas({ itens, agora, fusoEscola, fusoExibicao, params = {} }: Props) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: false });
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const instante = useMemo(() => new Date(agora), [agora]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, ItemAgenda[]>();
    for (const i of itens) {
      const g = grupoDoItem(i, instante, fusoEscola);
      mapa.set(g, [...(mapa.get(g) ?? []), i]);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => (instanteDoItem(a)?.getTime() ?? 0) - (instanteDoItem(b)?.getTime() ?? 0) || (dataCivilDoItem(a, fusoEscola) ?? "").localeCompare(dataCivilDoItem(b, fusoEscola) ?? ""));
    }
    return ORDEM_GRUPOS.filter((g) => mapa.has(g)).map((g) => ({ grupo: g, itens: mapa.get(g)! }));
  }, [itens, instante, fusoEscola]);

  const versaoPorChave = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of itens) if (i.tipo === "tarefa") m.set(chaveItem(i), i.tarefa.versao);
    return m;
  }, [itens]);

  const alternar = (chave: string) => setMarcadas((atual) => (atual.includes(chave) ? atual.filter((c) => c !== chave) : [...atual, chave]));
  const lote = acoesLote(marcadas);

  async function concluirLote() {
    const falhas: string[] = [];
    const d = await acao.executar(async (): Promise<Resultado<unknown>> => {
      for (const chave of lote.concluir) {
        const r = await concluirTarefa(chave.slice(1), versaoPorChave.get(chave) ?? 0);
        if (!r.ok) falhas.push(r.erro);
      }
      if (falhas.length > 0) return { ok: false, erro: `${falhas.length} de ${lote.concluir.length} não puderam ser concluídas: ${falhas[0]}` };
      return { ok: true };
    }, `${lote.concluir.length} ${lote.concluir.length === 1 ? "tarefa concluída" : "tarefas concluídas"}.`);
    if (d?.tipo === "ok") setMarcadas([]);
    router.refresh();
  }

  if (!itens.length) return <EstadoVazio bloco>Nenhuma tarefa por aqui. Crie uma para começar.</EstadoVazio>;

  return (
    <div className="space-y-6">
      {marcadas.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-brand-bg px-3 py-2 text-sm text-brand-800">
          <span>{marcadas.length} {marcadas.length === 1 ? "selecionado" : "selecionados"}</span>
          {lote.ignoradas > 0 && <span className="text-gray-600">Mensagens agendadas não entram ({lote.ignoradas}).</span>}
          <Botao tamanho="sm" disabled={lote.concluir.length === 0 || acao.ocupado} onClick={concluirLote}>Concluir selecionadas</Botao>
        </div>
      )}
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
      {grupos.map(({ grupo, itens: lista }) => (
        <section key={grupo} aria-labelledby={`grupo-${grupo}`}>
          <h2 id={`grupo-${grupo}`} className="mb-2 text-sm font-medium text-gray-700">
            <span>{ROTULO_GRUPO[grupo]}</span> <span className="text-gray-500">{lista.length}</span>
          </h2>
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
            {lista.map((i) => (
              <LinhaItem key={chaveItem(i)} item={i} marcado={marcadas.includes(chaveItem(i))} aoMarcar={() => alternar(chaveItem(i))} fusoEscola={fusoEscola} fusoExibicao={fusoExibicao} params={params} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function LinhaItem({ item, marcado, aoMarcar, fusoEscola, fusoExibicao, params }: { item: ItemAgenda; marcado: boolean; aoMarcar: () => void; fusoEscola: string; fusoExibicao: string; params: ParamsTarefas }) {
  const data = dataCivilDoItem(item, fusoEscola);
  const instante = instanteDoItem(item);
  const hora = instante ? textoHora(instante, fusoExibicao, fusoEscola) : null;
  const quando = (
    <>
      {data ? dataCurta(data) : "Sem data"}
      {hora && <> · {hora.hora}</>}
      {hora?.dica && <span className="text-xs text-gray-500"> ({hora.dica})</span>}
    </>
  );

  if (item.tipo === "mensagem") {
    return (
      <li className="flex items-start gap-3 p-3 max-sm:min-h-11">
        <span aria-hidden className="mt-1 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-gray-900">Mensagem para {item.nomeContato}</p>
          <p className="truncate text-xs text-gray-600">{item.texto}</p>
          <p className="text-xs text-gray-600">{quando} · {STATUS_MENSAGEM_AGENDADA_LABEL[item.status]}</p>
        </div>
      </li>
    );
  }

  const t = item.tarefa;
  const aberta = t.status === "ABERTA";
  return (
    <li className="flex items-start gap-3 p-3 max-sm:min-h-11">
      {aberta ? (
        <input type="checkbox" checked={marcado} onChange={aoMarcar} aria-label={`Selecionar ${t.titulo}`} className="mt-1 h-4 w-4 shrink-0 max-sm:h-6 max-sm:w-6" />
      ) : (
        <span aria-hidden className="mt-1 h-4 w-4 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <Link href={hrefTarefas({ ...params, t: t.id })} className={`block truncate text-sm font-medium hover:underline ${aberta ? "text-gray-900" : "text-gray-500 line-through"}`}>{t.titulo}</Link>
        <p className="text-xs text-gray-600">
          {TIPO_TAREFA_LABEL[t.tipo]} · {quando}
          {t.prioridade === "ALTA" && <> · {PRIORIDADE_TAREFA_LABEL[t.prioridade]}</>}
          {" · "}{t.responsavel?.nome ?? "Fila do setor"}
        </p>
      </div>
    </li>
  );
}
