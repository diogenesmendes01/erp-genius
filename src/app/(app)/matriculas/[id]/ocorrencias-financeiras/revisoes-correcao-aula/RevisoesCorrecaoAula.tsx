"use client";

import { useRef, useState, useTransition } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { decidirRevisaoFinanceiraCorrecaoAula, proporRevisaoFinanceiraCorrecaoAula, consultarRevisoesFinanceirasCorrecaoAula } from "@/server/financeiro/revisao-correcao-aula";

type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarRevisoesFinanceirasCorrecaoAula>>, { ok: true }>["dado"]>;
const data = (v: Date | string, fuso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(new Date(v));
const Foto = z.object({ fundamento: z.object({ participacaoAnterior: z.string(), participacaoProposta: z.string(), ocorrenciaHistoricaTipo: z.string(), desfechoHistorico: z.string(), minutosEquivalentes: z.number(), valorPreservado: z.union([z.number(), z.string()]), moeda: z.string() }), ocorrencia: z.object({ id: z.string(), versao: z.number() }), conferencia: z.object({ id: z.string() }), cobranca: z.object({ id: z.string(), status: z.string(), valorNegociado: z.union([z.number(), z.string()]), valorRecebido: z.union([z.number(), z.string()]).nullable(), saldo: z.union([z.number(), z.string()]).nullable(), moeda: z.string(), valorLiquidadoCredito: z.union([z.number(), z.string()]), valorCompensadoPermuta: z.union([z.number(), z.string()]) }).nullable(), informesPagamento: z.array(z.object({ id: z.string(), status: z.string() })), recebimentos: z.array(z.object({ id: z.string(), valor: z.union([z.number(), z.string()]), moeda: z.string() })), destinacoes: z.array(z.object({ id: z.string(), tipo: z.string(), valor: z.union([z.number(), z.string()]) })) }).passthrough();

export function RevisoesCorrecaoAula({ matriculaId, dados }: { matriculaId: string; dados: Dados }) {
  const router = useRouter(), [ocupado, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  const chaves = useRef(new Map<string, { payload: string; chave: string }>());
  const preparar = (propostaCorrecaoAulaId: string, form: HTMLFormElement) => iniciar(async () => {
    const motivo = String(new FormData(form).get("motivo") ?? ""), payload = JSON.stringify({ propostaCorrecaoAulaId, motivo });
    const anterior = chaves.current.get(propostaCorrecaoAulaId), chave = anterior?.payload === payload ? anterior.chave : crypto.randomUUID(); chaves.current.set(propostaCorrecaoAulaId, { payload, chave });
    const r = await proporRevisaoFinanceiraCorrecaoAula({ propostaCorrecaoAulaId, motivo, chaveIdempotencia: chave });
    setMensagem(r.ok ? "Revisão preparada. Outra pessoa do Financeiro ou Administração deve decidir." : r.erro); if (r.ok) { chaves.current.delete(propostaCorrecaoAulaId); router.refresh(); }
  });
  const decidir = (propostaId: string, aprovada: boolean, form: HTMLFormElement) => iniciar(async () => {
    const r = await decidirRevisaoFinanceiraCorrecaoAula({ propostaId, aprovada, motivo: String(new FormData(form).get("motivo") ?? "") });
    setMensagem(r.ok ? (aprovada ? "Revisão aprovada; a gestão ainda precisa publicar Q23." : "Revisão rejeitada; o histórico foi preservado.") : r.erro); if (r.ok) router.refresh();
  });
  return <section className="space-y-4">
    {dados.candidatas.map(p => <article key={p.id} className="rounded border p-4 space-y-2">
      <h2 className="font-medium">Proposta Q23 v{p.versao} · {data(p.encontro.inicio, p.encontro.fusoOrigem)}</h2>
      <form onSubmit={e => { e.preventDefault(); preparar(p.id, e.currentTarget); }} className="space-y-2"><label className="block">Justificativa financeira sem alteração de valores<textarea name="motivo" required minLength={5} maxLength={3000} disabled={ocupado} className="block w-full rounded border p-2" /></label><button disabled={ocupado} className="rounded border p-2">Preparar revisão Q92</button></form>
    </article>)}
    {!dados.candidatas.length && <p>Nenhuma proposta Q23 pendente nesta matrícula.</p>}
    <h2 className="text-xl">Histórico imutável</h2>
    {dados.revisoes.map(r => { const foto = Foto.safeParse(r.fotografia), podeDecidir = r.podeDecidir; return <article key={r.id} className="rounded border p-4 space-y-2"><p>Q23 v{r.propostaCorrecaoAula.versao} · revisão financeira v{r.versao} · {data(r.propostaCorrecaoAula.encontro.inicio, r.propostaCorrecaoAula.encontro.fusoOrigem)}</p><p>Preparada por {r.preparador.nome}: {r.motivo}</p>{foto.success ? <section className="text-sm"><p>Fundamento Q92: {foto.data.fundamento.participacaoAnterior} → {foto.data.fundamento.participacaoProposta}; ocorrência v{foto.data.ocorrencia.versao} {foto.data.fundamento.ocorrenciaHistoricaTipo}, conferência {foto.data.fundamento.desfechoHistorico}.</p><p>{foto.data.fundamento.minutosEquivalentes} minutos · valor preservado {foto.data.fundamento.valorPreservado} {foto.data.fundamento.moeda}.</p><p>{foto.data.cobranca ? `Cobrança ${foto.data.cobranca.status}; negociado ${foto.data.cobranca.valorNegociado}, recebido ${foto.data.cobranca.valorRecebido ?? 0}, saldo ${foto.data.cobranca.saldo ?? 0} ${foto.data.cobranca.moeda}; crédito ${foto.data.cobranca.valorLiquidadoCredito}; permuta ${foto.data.cobranca.valorCompensadoPermuta}.` : "Ainda sem item de emissão."}</p><p>Informes: {foto.data.informesPagamento.length ? foto.data.informesPagamento.map(i => i.status).join(", ") : "nenhum"}. Recebimentos: {foto.data.recebimentos.length}; destinações: {foto.data.destinacoes.map(d => `${d.tipo} ${d.valor}`).join(", ") || "nenhuma"}.</p></section> : <p role="alert">Fotografia histórica indisponível para apresentação; não decida sem nova conferência.</p>}{r.decisao ? <p>Decisão: {r.decisao.aprovada ? "aprovada" : "rejeitada"} por {r.decisao.decisor.nome}. {r.decisao.motivo}</p> : podeDecidir ? <form onSubmit={e => { e.preventDefault(); decidir(r.id, true, e.currentTarget); }} className="space-y-2"><label className="block">Motivo da decisão<textarea name="motivo" required minLength={5} maxLength={3000} disabled={ocupado} className="block w-full rounded border p-2" /></label><button disabled={ocupado} className="rounded border p-2">Aprovar sem alteração de valores</button><button disabled={ocupado} formAction="#" onClick={e => { e.preventDefault(); const form = e.currentTarget.form; if (form) decidir(r.id, false, form); }} className="ml-2 rounded border p-2">Rejeitar</button></form> : <p>Outra pessoa com alçada financeira, distinta da preparação e autoria Q23, deve decidir.</p>}</article>; })}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
