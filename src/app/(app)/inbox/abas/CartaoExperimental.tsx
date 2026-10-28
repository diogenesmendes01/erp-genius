"use client";

import { useState } from "react";
import { IconCalendarCheck } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import { CampoDataHoraLocal } from "@/components/CampoDataHoraLocal";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { fusoDoCampoLocal } from "@/server/operacao/fuso-entrada";
import { agendarExperimentalNoInbox, atribuirProfessorExperimentalNoInbox, confirmarExperimentalNoInbox } from "@/server/inbox/acoes-painel";
import type { OportunidadeAtualPainel } from "@/server/inbox/painel-oportunidades";

type EstadoExperimental = Pick<OportunidadeAtualPainel, "etapa" | "experimentalConfirmada">;
export function statusExperimental(o: EstadoExperimental): "Agendada" | "Confirmada" | "Realizada" | "Não compareceu" {
  if (o.etapa === "NO_SHOW") return "Não compareceu";
  if (o.etapa === "EXPERIMENTAL_REALIZADA") return "Realizada";
  return o.experimentalConfirmada ? "Confirmada" : "Agendada";
}

const CAMPO = "w-full rounded-md border border-gray-300 bg-surface px-2 py-1 text-[13px] max-sm:min-h-11";

export function CartaoExperimental({ oportunidade: o, fuso, fusoEscola, podeAbrirFunil = false }: {
  oportunidade: OportunidadeAtualPainel; fuso: string | null; fusoEscola: string; podeAbrirFunil?: boolean;
}) {
  const acao = useAcaoCliente({ idempotente: false });
  const atendimentoId = o.atendimentoId;
  const professores = o.professores ?? [];
  const [professorId, setProfessorId] = useState(o.professorExperimentalId ?? "");
  const [dataLocal, setDataLocal] = useState("");
  const [abrindoAgenda, setAbrindoAgenda] = useState(!o.dataExperimental);
  const fusoCampo = fusoDoCampoLocal(fuso, fusoEscola);
  if (!o.dataExperimental && !atendimentoId) return null;

  async function agendar() {
    if (!atendimentoId || !dataLocal) return;
    await acao.executar(
      () => agendarExperimentalNoInbox(atendimentoId, o.id, { dataLocal, fuso: fusoCampo, ...(professorId ? { professorId } : {}) }),
      o.dataExperimental ? "Experimental remarcada." : "Experimental agendada.",
    );
  }

  async function trocarProfessor(id: string) {
    setProfessorId(id);
    if (!atendimentoId || !id || o.etapa !== "EXPERIMENTAL_AGENDADA" || id === o.professorExperimentalId) return;
    await acao.executar(() => atribuirProfessorExperimentalNoInbox(atendimentoId, o.id, id), "Professor da experimental atualizado.");
  }

  const quando = o.dataExperimental ? formatarInstanteExibicao(o.dataExperimental, fuso, fusoEscola) : null;
  const podeConfirmar = !!atendimentoId && o.etapa === "EXPERIMENTAL_AGENDADA" && !o.experimentalConfirmada;
  return <section aria-label="Aula experimental" className="min-w-0 space-y-2 rounded-[10px] border border-gray-200 bg-surface-muted p-3">
    <div className="flex items-center gap-2"><IconCalendarCheck size={16} aria-hidden /><h4 className="flex-1 text-[13px] font-semibold">Aula experimental</h4>
      {podeAbrirFunil && <a href={"/funil?o=" + encodeURIComponent(o.id)} className="inline-flex min-h-11 items-center text-[13px] text-brand-700 underline">Editar</a>}
    </div>
    {quando && <p className="text-[13px] [overflow-wrap:anywhere]"><time dateTime={o.dataExperimental!} title={"Horário em " + quando.fuso}>{quando.texto}</time> · {o.professorExperimental ?? "Sem professor"}</p>}
    {quando && <span className={"inline-flex min-h-[22px] items-center rounded-full px-2 text-xs font-semibold " + (o.etapa === "NO_SHOW" ? "bg-red-50 text-red-700" : "bg-brand-bg text-brand-700")}>{statusExperimental(o)}</span>}
    {atendimentoId && (
      <div className="grid gap-2">
        <select aria-label="Professor da experimental" className={CAMPO} value={professorId} disabled={acao.ocupado} onChange={(e) => void trocarProfessor(e.target.value)}>
          <option value="">Sem professor</option>
          {professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        {(abrindoAgenda || !o.dataExperimental) ? (
          <div className="grid gap-2">
            <CampoDataHoraLocal aria-label="Data e hora da experimental" fuso={fusoCampo} className={CAMPO} value={dataLocal} disabled={acao.ocupado} onChange={(e) => setDataLocal(e.target.value)} />
            <Botao variante="secundario" disabled={!dataLocal || acao.ocupado} onClick={() => void agendar()}>{o.dataExperimental ? "Remarcar experimental" : "Agendar experimental"}</Botao>
          </div>
        ) : (
          <Botao variante="secundario" disabled={acao.ocupado} onClick={() => setAbrindoAgenda(true)}>Remarcar experimental</Botao>
        )}
        {podeConfirmar && <Botao variante="secundario" disabled={acao.ocupado} onClick={() => void acao.executar(() => confirmarExperimentalNoInbox(atendimentoId, o.id), "Presença na experimental confirmada.")}>Confirmar presença</Botao>}
        {acao.erro && <p role="alert" className="text-xs text-red-700">{acao.erro}</p>}
      </div>
    )}
  </section>;
}
