"use client";

import { useRef, useState, useTransition } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { decidirRevisaoFinanceiraCorrecaoAula, proporRevisaoFinanceiraCorrecaoAula, consultarRevisoesFinanceirasCorrecaoAula } from "@/server/financeiro/revisao-correcao-aula";

type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarRevisoesFinanceirasCorrecaoAula>>, { ok: true }>["dado"]>;
const data = (v: Date | string, preferencia: string | null, fuso: string) => { const e = formatarInstanteExibicao(v, preferencia, fuso); return `${e.texto} (${e.fuso})`; };
const dinheiro = z.union([z.number(), z.string()]);
const Foto = z.object({
  fundamento: z.object({ participacaoAnterior: z.string(), participacaoProposta: z.string(), minutosEquivalentes: z.number(), valorPreservado: dinheiro, moeda: z.string(), politica: z.string(), fonte: z.string().optional(), ocorrenciaHistoricaTipo: z.string().optional(), desfechoHistorico: z.string().optional() }),
  ocorrencia: z.object({ id: z.string(), versao: z.number(), tipo: z.string().optional() }).nullable(),
  conferencia: z.object({ id: z.string(), desfecho: z.string().optional() }).nullable(),
  reservaConsumida: z.object({ id: z.string(), consumoId: z.string(), minutos: z.number(), fonte: z.string(), conferenciaOcorrenciaId: z.string().nullable() }).optional(),
  compraAntecipada: z.object({ id: z.string(), cobrancaId: z.string(), minutosComprados: z.number(), valorPagoAlocado: dinheiro, moeda: z.string() }).optional(),
  condicoes: z.object({ id: z.string(), versao: z.number(), documentoId: z.string(), regras: z.unknown() }).optional(),
  cobranca: z.object({ id: z.string(), status: z.string(), valorNegociado: dinheiro, valorRecebido: dinheiro.nullable(), saldo: dinheiro.nullable(), moeda: z.string(), valorLiquidadoCredito: dinheiro, valorCompensadoPermuta: dinheiro }).nullable(),
  informesPagamento: z.array(z.object({ id: z.string(), status: z.string() })), recebimentos: z.array(z.object({ id: z.string(), valor: dinheiro, moeda: z.string() })), destinacoes: z.array(z.object({ id: z.string(), tipo: z.string(), valor: dinheiro })),
}).passthrough();

export function RevisoesCorrecaoAula({ matriculaId, dados, fusoExibicao = null }: { matriculaId: string; dados: Dados; fusoExibicao?: string | null }) {
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
    setMensagem(r.ok ? (aprovada ? "Revisão aprovada; a gestão ainda precisa publicar a correção." : "Revisão rejeitada; o histórico foi preservado.") : r.erro); if (r.ok) router.refresh();
  });
  return <section className="space-y-4">
    {dados.candidatas.map(p => <article key={p.id} className="rounded border p-4 space-y-2">
      <h2 className="font-medium">Correção de presença v{p.versao} · {data(p.encontro.inicio, fusoExibicao, p.encontro.fusoOrigem)}</h2>
      {p.podePreparar
        ? <form onSubmit={e => { e.preventDefault(); preparar(p.id, e.currentTarget); }} className="space-y-2"><label className="block">Justificativa financeira sem alteração de valores<textarea name="motivo" required minLength={5} maxLength={3000} disabled={ocupado} className="block w-full rounded border p-2" /></label><button disabled={ocupado} className="rounded border p-2">Preparar revisão financeira</button></form>
        : <p>{p.preparoBloqueadoPor}</p>}
    </article>)}
    {!dados.candidatas.length && <p>Nenhuma correção de presença pendente nesta matrícula.</p>}
    <h2 className="text-xl">Histórico imutável</h2>
    {dados.revisoes.map(r => { const foto = Foto.safeParse(r.fotografia), podeDecidir = r.podeDecidir; return <article key={r.id} className="rounded border p-4 space-y-2"><p>Correção de presença v{r.propostaCorrecaoAula.versao} · revisão financeira v{r.versao} · {data(r.propostaCorrecaoAula.encontro.inicio, fusoExibicao, r.propostaCorrecaoAula.encontro.fusoOrigem)}</p><p>Preparada por {r.preparador.nome}: {r.motivo}</p>{foto.success ? <section className="text-sm space-y-1"><p>Fundamento financeiro: {foto.data.fundamento.participacaoAnterior} → {foto.data.fundamento.participacaoProposta}; {foto.data.fundamento.ocorrenciaHistoricaTipo ? `ocorrência v${foto.data.ocorrencia?.versao} ${foto.data.fundamento.ocorrenciaHistoricaTipo}, conferência ${foto.data.fundamento.desfechoHistorico}.` : `fonte ${foto.data.fundamento.fonte === "DIARIO_REALIZADO" ? "diário realizado" : "ocorrência financeira"}.`}</p><p>{foto.data.fundamento.minutosEquivalentes} minutos · valor preservado {foto.data.fundamento.valorPreservado} {foto.data.fundamento.moeda}.</p>{foto.data.reservaConsumida && <p>Reserva consumida {foto.data.reservaConsumida.id} ({foto.data.reservaConsumida.minutos} minutos), consumo {foto.data.reservaConsumida.consumoId}; fonte {foto.data.reservaConsumida.fonte === "DIARIO_REALIZADO" ? "diário realizado" : "conferência financeira"}. A reserva e o consumo históricos não serão regravados.</p>}{foto.data.compraAntecipada && <p>Compra antecipada {foto.data.compraAntecipada.id}: {foto.data.compraAntecipada.minutosComprados} minutos, valor alocado {foto.data.compraAntecipada.valorPagoAlocado} {foto.data.compraAntecipada.moeda}.</p>}{foto.data.condicoes && <p>Condições contratuais v{foto.data.condicoes.versao} ({foto.data.condicoes.documentoId}) sustentam a equivalência sem alteração de valores.</p>}<p>{foto.data.cobranca ? `Cobrança ${foto.data.cobranca.status}; negociado ${foto.data.cobranca.valorNegociado}, recebido ${foto.data.cobranca.valorRecebido ?? 0}, saldo ${foto.data.cobranca.saldo ?? 0} ${foto.data.cobranca.moeda}; crédito ${foto.data.cobranca.valorLiquidadoCredito}; permuta ${foto.data.cobranca.valorCompensadoPermuta}.` : "Ainda sem item de emissão."}</p><p>Informes: {foto.data.informesPagamento.length ? foto.data.informesPagamento.map(i => i.status).join(", ") : "nenhum"}. Recebimentos: {foto.data.recebimentos.length}; destinações: {foto.data.destinacoes.map(d => `${d.tipo} ${d.valor}`).join(", ") || "nenhuma"}.</p></section> : <p role="alert">Fotografia histórica indisponível para apresentação; não decida sem nova conferência.</p>}{!foto.success && !r.decisao && podeDecidir && <form onSubmit={e => { e.preventDefault(); decidir(r.id, false, e.currentTarget); }} className="space-y-2"><label className="block">Motivo da rejeição<textarea name="motivo" required minLength={5} maxLength={3000} disabled={ocupado} className="block w-full rounded border p-2" /></label><button disabled={ocupado} className="rounded border p-2">Rejeitar revisão incompleta</button></form>}{r.decisao ? <p>Decisão: {r.decisao.aprovada ? "aprovada" : "rejeitada"} por {r.decisao.decisor.nome}. {r.decisao.motivo}</p> : podeDecidir && foto.success ? <form onSubmit={e => { e.preventDefault(); decidir(r.id, true, e.currentTarget); }} className="space-y-2"><label className="block">Motivo da decisão<textarea name="motivo" required minLength={5} maxLength={3000} disabled={ocupado} className="block w-full rounded border p-2" /></label><button disabled={ocupado} className="rounded border p-2">Aprovar sem alteração de valores</button><button disabled={ocupado} formAction="#" onClick={e => { e.preventDefault(); const form = e.currentTarget.form; if (form) decidir(r.id, false, form); }} className="ml-2 rounded border p-2">Rejeitar</button></form> : <p>Outra pessoa com alçada financeira, distinta da preparação e autoria da correção, deve decidir.</p>}</article>; })}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
