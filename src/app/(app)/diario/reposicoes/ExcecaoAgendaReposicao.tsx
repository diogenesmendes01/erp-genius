"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirExcecaoAgendaReposicaoIndividual, proporExcecaoAgendaReposicaoIndividual } from "@/server/diario/reposicao-agenda";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { montarPropostaExcecaoAgenda, type HorarioExcecaoConferido } from "./ExcecaoAgendaControle";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";

export type ExcecaoAgenda = {
  id: string; professor: string; inicio: string; fim: string; fuso: string; motivo: string; evidencia: string;
  solicitante: string; criadaEm: string; versao: number;
  decisao: null | { aprovada: boolean; motivo: string; decididaEm: string; decisor: string };
  podeDecidir: boolean;
};

export type HorarioExcecaoProposto = HorarioExcecaoConferido;

/** Q19: a proposta reaproveita o horário já conferido; nunca aceita identificadores digitados. */
export function ExcecaoAgendaReposicao({ reposicaoId, proposta, excecoes, preferenciaFusoExibicao }: {
  reposicaoId: string;
  proposta?: HorarioExcecaoProposto | null;
  excecoes: ExcecaoAgenda[];
  preferenciaFusoExibicao: string | null;
}) {
  const [ocupado, iniciar] = useTransition(); const [erro, setErro] = useState(""); const [sucesso, setSucesso] = useState(""); const router = useRouter();
  const chaves = useRef(new Map<string, string>()).current;
  const propor = (form: HTMLFormElement) => {
    if (!proposta) return;
    const dados = new FormData(form);
    const base = montarPropostaExcecaoAgenda(reposicaoId, proposta, String(dados.get("motivo") ?? ""), String(dados.get("evidencia") ?? ""), "");
    const identidade = JSON.stringify(base), chaveIdempotencia = chaves.get(identidade) ?? crypto.randomUUID();
    chaves.set(identidade, chaveIdempotencia);
    const entrada = { ...base, chaveIdempotencia };
    iniciar(async () => {
      setErro(""); setSucesso("");
      try {
        const r = await proporExcecaoAgendaReposicaoIndividual(entrada);
        if (!r.ok) { setErro(r.erro); return; }
        setSucesso("Exceção proposta para decisão independente. A agenda não foi criada."); router.refresh();
      } catch { setErro("A proposta não foi confirmada. Consulte a agenda antes de reenviar."); }
    });
  };
  const decidir = (form: HTMLFormElement, excecaoId: string) => {
    const dados = new FormData(form);
    iniciar(async () => {
      setErro(""); setSucesso("");
      try {
        const r = await decidirExcecaoAgendaReposicaoIndividual({ excecaoId, aprovar: dados.get("decisao") === "aprovar", motivo: String(dados.get("motivo") ?? "") });
        if (!r.ok) { setErro(r.erro); return; }
        setSucesso("Decisão registrada. A aprovação não agenda a reposição."); router.refresh();
      } catch { setErro("A decisão não foi confirmada. Consulte a fila antes de repetir."); }
    });
  };
  return <section className="space-y-3 border-t pt-3" aria-label="Exceções de agenda da reposição">
    {proposta && <form className="space-y-2 rounded border p-3" onSubmit={e => { e.preventDefault(); propor(e.currentTarget); }}>
      <h3 className="font-medium">Propor exceção de agenda</h3>
      <p role="status">O horário não letivo conferido é {proposta.inicioLocal} a {proposta.fimLocal}, no fuso {proposta.fuso}, com {proposta.professor}. A aprovação será de outra pessoa e não agenda a aula.</p>
      <label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <label className="block">Evidência<textarea name="evidencia" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Enviando…" : "Propor exceção"}</button>
    </form>}
    {excecoes.length > 0 && <div className="space-y-3"><h3 className="font-medium">Histórico de exceções de agenda</h3>{excecoes.map(excecao => {
      const inicio = formatarInstanteExibicao(excecao.inicio, preferenciaFusoExibicao, excecao.fuso);
      const fim = formatarInstanteExibicao(excecao.fim, preferenciaFusoExibicao, excecao.fuso);
      const criadaEm = formatarInstanteExibicao(excecao.criadaEm, preferenciaFusoExibicao, excecao.fuso);
      const decididaEm = excecao.decisao && formatarInstanteExibicao(excecao.decisao.decididaEm, preferenciaFusoExibicao, excecao.fuso);
      return <article key={excecao.id} className="space-y-2 rounded border p-3">
      <p><strong>Versão {excecao.versao}:</strong> {excecao.professor}, {inicio.texto} a {fim.texto} (exibido em {inicio.fuso}; origem {excecao.fuso}).</p>
      <p>Proposta por {excecao.solicitante} em {criadaEm.texto} (horário exibido em {criadaEm.fuso}): {excecao.motivo}</p><p className="whitespace-pre-wrap">Evidência: {excecao.evidencia}</p>
      {excecao.decisao ? <p role="status">{excecao.decisao.aprovada ? "Aprovada" : "Rejeitada"} por {excecao.decisao.decisor} em {decididaEm!.texto} (horário exibido em {decididaEm!.fuso}): {excecao.decisao.motivo}. A decisão não cria agenda.</p> : excecao.podeDecidir ? <form className="space-y-2" onSubmit={e => { e.preventDefault(); decidir(e.currentTarget, excecao.id); }}><label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2"><option value="" disabled>Selecione</option><option value="aprovar">Aprovar exceção pontual</option><option value="rejeitar">Rejeitar exceção</option></select></label><label className="block">Justificativa<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label><button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Registrar decisão</button></form> : <p role="status">Aguardando decisão de outra pessoa da gestão.</p>}
    </article>})}</div>}
    {erro && <p role="alert">{erro}</p>}<MensagemStatus texto={sucesso} />
  </section>;
}
