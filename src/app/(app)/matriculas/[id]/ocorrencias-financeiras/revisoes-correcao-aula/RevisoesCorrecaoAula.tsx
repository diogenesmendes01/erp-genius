"use client";

import { useRef, useState, useTransition } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { decidirRevisaoFinanceiraCorrecaoAula, proporRevisaoFinanceiraCorrecaoAula, consultarRevisoesFinanceirasCorrecaoAula } from "@/server/financeiro/revisao-correcao-aula";
import { MensagemStatus } from "@/components/MensagemStatus";
import { formatarMoeda } from "@/lib/dinheiro";
import { STATUS_COBRANCA_LABEL, rotular } from "@/lib/labels";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { executarAcaoCliente } from "@/lib/acao-cliente";

type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarRevisoesFinanceirasCorrecaoAula>>, { ok: true }>["dado"]>;
const data = (v: Date | string, fuso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(new Date(v));
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

export function RevisoesCorrecaoAula({ matriculaId, dados }: { matriculaId: string; dados: Dados }) {
  // executarAcaoCliente (e não useAcaoCliente): o teste de callbacks chama o componente fora do React,
  // com useState/useRef/useTransition simulados — um hook a mais (useCallback) quebraria a montagem.
  const router = useRouter(), [ocupado, iniciar] = useTransition(), [erro, setErro] = useState(""), [sucesso, setSucesso] = useState("");
  // Origem do resultado ("preparar:<id>" ou "decidir:<id>"): o erro aparece junto do formulário que o disparou.
  const [alvo, setAlvo] = useState("");
  const chaves = useRef(new Map<string, { payload: string; chave: string }>());
  const preparar = (propostaCorrecaoAulaId: string, form: HTMLFormElement) => iniciar(async () => {
    const motivo = String(new FormData(form).get("motivo") ?? ""), payload = JSON.stringify({ propostaCorrecaoAulaId, motivo });
    const anterior = chaves.current.get(propostaCorrecaoAulaId), chave = anterior?.payload === payload ? anterior.chave : crypto.randomUUID(); chaves.current.set(propostaCorrecaoAulaId, { payload, chave });
    setAlvo(`preparar:${propostaCorrecaoAulaId}`); setErro(""); setSucesso("");
    // Chave estável por entrada (acima) e o servidor devolve a revisão existente quando ela se repete
    // (server/financeiro/revisao-correcao-aula.ts:36-39): reenviar os mesmos dados é seguro.
    const d = await executarAcaoCliente(() => proporRevisaoFinanceiraCorrecaoAula({ propostaCorrecaoAulaId, motivo, chaveIdempotencia: chave }), { idempotente: true });
    if (d.tipo !== "ok") { setErro(d.mensagem); return; }
    setSucesso("Revisão preparada. Outra pessoa do Financeiro ou Administração deve decidir."); chaves.current.delete(propostaCorrecaoAulaId); router.refresh();
  });
  const decidir = (propostaId: string, aprovada: boolean, form: HTMLFormElement) => iniciar(async () => {
    setAlvo(`decidir:${propostaId}`); setErro(""); setSucesso("");
    // Decisão sem chave de idempotência (revisao-correcao-aula.ts:62); só a repetição idêntica pelo mesmo
    // decisor é reconhecida (:68-70). Conferir antes de repetir.
    const d = await executarAcaoCliente(() => decidirRevisaoFinanceiraCorrecaoAula({ propostaId, aprovada, motivo: String(new FormData(form).get("motivo") ?? "") }), { idempotente: false });
    if (d.tipo !== "ok") { setErro(d.mensagem); return; }
    setSucesso(aprovada ? "Revisão aprovada; a gestão ainda precisa publicar a correção." : "Revisão rejeitada; o histórico foi preservado."); router.refresh();
  });
  return <section className="space-y-4">
    {dados.candidatas.map(p => <article key={p.id} className="rounded border p-4 space-y-2">
      <h2 className="font-medium">Correção de presença v{p.versao} · {data(p.encontro.inicio, p.encontro.fusoOrigem)}</h2>
      {p.podePreparar
        ? <form onSubmit={e => { e.preventDefault(); preparar(p.id, e.currentTarget); }} className="space-y-2"><label className="block">Justificativa financeira sem alteração de valores<textarea name="motivo" required minLength={5} maxLength={3000} disabled={ocupado} className="block w-full rounded border p-2" /></label><button disabled={ocupado} className="rounded border p-2">Preparar revisão financeira</button></form>
        : <p>{p.preparoBloqueadoPor}</p>}
      {/* Montado só com erro: o FeedbackAcao usa efeito, e o teste de callbacks percorre a árvore fora do React. */}
      {alvo === `preparar:${p.id}` && erro && <FeedbackAcao erro={erro} />}
    </article>)}
    {/* A candidata some da lista depois do preparo; a confirmação fica logo abaixo dela. */}
    <MensagemStatus texto={alvo.startsWith("preparar:") ? sucesso : null} />
    {!dados.candidatas.length && <p>Nenhuma correção de presença pendente nesta matrícula.</p>}
    <h2 className="text-xl">Histórico imutável</h2>
    {dados.revisoes.map(r => { const foto = Foto.safeParse(r.fotografia), podeDecidir = r.podeDecidir; return <article key={r.id} className="rounded border p-4 space-y-2"><p>Correção de presença v{r.propostaCorrecaoAula.versao} · revisão financeira v{r.versao} · {data(r.propostaCorrecaoAula.encontro.inicio, r.propostaCorrecaoAula.encontro.fusoOrigem)}</p><p>Preparada por {r.preparador.nome}: {r.motivo}</p>{foto.success ? <section className="text-sm space-y-1"><p>Fundamento financeiro: {foto.data.fundamento.participacaoAnterior} → {foto.data.fundamento.participacaoProposta}; {foto.data.fundamento.ocorrenciaHistoricaTipo ? `ocorrência v${foto.data.ocorrencia?.versao} ${foto.data.fundamento.ocorrenciaHistoricaTipo}, conferência ${foto.data.fundamento.desfechoHistorico}.` : `fonte ${foto.data.fundamento.fonte === "DIARIO_REALIZADO" ? "diário realizado" : "ocorrência financeira"}.`}</p><p>{foto.data.fundamento.minutosEquivalentes} minutos · valor preservado {formatarMoeda(foto.data.fundamento.valorPreservado, foto.data.fundamento.moeda)}.</p>{foto.data.reservaConsumida && <p>Reserva consumida {foto.data.reservaConsumida.id} ({foto.data.reservaConsumida.minutos} minutos), consumo {foto.data.reservaConsumida.consumoId}; fonte {foto.data.reservaConsumida.fonte === "DIARIO_REALIZADO" ? "diário realizado" : "conferência financeira"}. A reserva e o consumo históricos não serão regravados.</p>}{foto.data.compraAntecipada && <p>Compra antecipada {foto.data.compraAntecipada.id}: {foto.data.compraAntecipada.minutosComprados} minutos, valor alocado {formatarMoeda(foto.data.compraAntecipada.valorPagoAlocado, foto.data.compraAntecipada.moeda)}.</p>}{foto.data.condicoes && <p>Condições contratuais v{foto.data.condicoes.versao} ({foto.data.condicoes.documentoId}) sustentam a equivalência sem alteração de valores.</p>}<p>{foto.data.cobranca ? `Cobrança ${rotular(STATUS_COBRANCA_LABEL, foto.data.cobranca.status)}; negociado ${formatarMoeda(foto.data.cobranca.valorNegociado, foto.data.cobranca.moeda)}, recebido ${formatarMoeda(foto.data.cobranca.valorRecebido ?? 0, foto.data.cobranca.moeda)}, saldo ${formatarMoeda(foto.data.cobranca.saldo ?? 0, foto.data.cobranca.moeda)}; crédito ${formatarMoeda(foto.data.cobranca.valorLiquidadoCredito, foto.data.cobranca.moeda)}; permuta ${formatarMoeda(foto.data.cobranca.valorCompensadoPermuta, foto.data.cobranca.moeda)}.` : "Ainda sem item de emissão."}</p><p>Informes: {foto.data.informesPagamento.length ? foto.data.informesPagamento.map(i => i.status).join(", ") : "nenhum"}. Recebimentos: {foto.data.recebimentos.length}; destinações: {foto.data.destinacoes.map(d => `${d.tipo} ${formatarMoeda(d.valor, foto.data.cobranca?.moeda ?? "")}`).join(", ") || "nenhuma"}.</p></section> : <p role="alert">Fotografia histórica indisponível para apresentação; não decida sem nova conferência.</p>}{!foto.success && !r.decisao && podeDecidir && <form onSubmit={e => { e.preventDefault(); decidir(r.id, false, e.currentTarget); }} className="space-y-2"><label className="block">Motivo da rejeição<textarea name="motivo" required minLength={5} maxLength={3000} disabled={ocupado} className="block w-full rounded border p-2" /></label><button disabled={ocupado} className="rounded border p-2">Rejeitar revisão incompleta</button></form>}{r.decisao ? <p>Decisão: {r.decisao.aprovada ? "aprovada" : "rejeitada"} por {r.decisao.decisor.nome}. {r.decisao.motivo}</p> : podeDecidir && foto.success ? <form onSubmit={e => { e.preventDefault(); decidir(r.id, true, e.currentTarget); }} className="space-y-2"><label className="block">Motivo da decisão<textarea name="motivo" required minLength={5} maxLength={3000} disabled={ocupado} className="block w-full rounded border p-2" /></label><button disabled={ocupado} className="rounded border p-2">Aprovar sem alteração de valores</button><button disabled={ocupado} formAction="#" onClick={e => { e.preventDefault(); const form = e.currentTarget.form; if (form) decidir(r.id, false, form); }} className="ml-2 rounded border p-2">Rejeitar</button></form> : <p>Outra pessoa com alçada financeira, distinta da preparação e autoria da correção, deve decidir.</p>}{alvo === `decidir:${r.id}` && erro && <FeedbackAcao erro={erro} />}<MensagemStatus texto={alvo === `decidir:${r.id}` ? sucesso : null} /></article>; })}
  </section>;
}
