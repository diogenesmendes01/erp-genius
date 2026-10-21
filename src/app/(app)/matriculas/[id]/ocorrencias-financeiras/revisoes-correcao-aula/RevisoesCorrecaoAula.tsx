"use client";

import { useRef, useState, useTransition } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { decidirRevisaoFinanceiraCorrecaoAula, proporRevisaoFinanceiraCorrecaoAula, consultarRevisoesFinanceirasCorrecaoAula } from "@/server/financeiro/revisao-correcao-aula";
import { MensagemStatus } from "@/components/MensagemStatus";
import { formatarMoeda } from "@/lib/dinheiro";
import { DESFECHO_OCORRENCIA_HORAS_LABEL, PARTICIPACAO_AULA_LABEL, STATUS_COBRANCA_LABEL, STATUS_PAGAMENTO_INFORMADO_LABEL, TIPO_DESTINACAO_RECEBIMENTO_LABEL, TIPO_OCORRENCIA_HORAS_LABEL, rotular } from "@/lib/labels";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { executarAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";

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
// Q175: o efeito é calculado pelo banco (q23_fotografia_nao_cobravel_175); a tela só o descreve.
const Efeito = z.object({ tipo: z.enum(["SEM_ITEM", "REDUZ_COBRANCA_ABERTA", "GERA_CREDITO", "DEVOLVE_MINUTOS"]), minutos: z.number().optional(), valorAula: dinheiro, moeda: z.string(), valorNegociadoAnterior: dinheiro.optional(), valorNegociadoNovo: dinheiro.optional(), creditoValor: dinheiro.optional() });
const FotoNaoCobravel = z.object({ efeito: Efeito }).passthrough();
const descreverEfeito = (bruto: unknown) => {
  const e = Efeito.safeParse(bruto); if (!e.success) return null;
  const v = (x: unknown) => formatarMoeda(x as number | string, e.data.moeda);
  if (e.data.tipo === "DEVOLVE_MINUTOS") return `A aula foi paga com horas pré-pagas: ${e.data.minutos ?? 0} minutos voltam ao saldo da mesma compra. Nenhum valor é cobrado nem devolvido.`;
  return e.data.tipo === "SEM_ITEM" ? `A aula (${v(e.data.valorAula)}) ainda não foi fechada: deixa de entrar no próximo fechamento de horas.`
    : e.data.tipo === "REDUZ_COBRANCA_ABERTA" ? `A cobrança em aberto cai de ${v(e.data.valorNegociadoAnterior)} para ${v(e.data.valorNegociadoNovo)}${Number(e.data.valorNegociadoNovo) === 0 ? " e é cancelada" : ""}.`
      : `A fatura já está quitada e permanece como está; nasce crédito de ${v(e.data.creditoValor)} na matrícula.`;
};

export function RevisoesCorrecaoAula({ dados }: { matriculaId: string; dados: Dados }) {
  // executarAcaoCliente (e não useAcaoCliente): o teste de callbacks chama o componente fora do React,
  // com useState/useRef/useTransition simulados — um hook a mais (useCallback) quebraria a montagem.
  const router = useRouter(), [ocupado, iniciar] = useTransition(), [erro, setErro] = useState(""), [sucesso, setSucesso] = useState("");
  // Origem do resultado ("preparar:<id>" ou "decidir:<id>"): o erro aparece junto do formulário que o disparou.
  const [alvo, setAlvo] = useState("");
  const chaves = useRef(new Map<string, { payload: string; chave: string }>());
  const preparar = (propostaCorrecaoAulaId: string, form: HTMLFormElement) => iniciar(async () => {
    const formulario = new FormData(form), motivo = String(formulario.get("motivo") ?? "");
    // Q175: o tipo é sempre escolha explícita; sem a declaração, a entrada continua a de antes (mesmo hash).
    const tipo = formulario.get("tipo") === "AULA_NAO_COBRAVEL" ? "AULA_NAO_COBRAVEL" as const : null, payload = JSON.stringify({ propostaCorrecaoAulaId, motivo, tipo });
    const anterior = chaves.current.get(propostaCorrecaoAulaId), chave = anterior?.payload === payload ? anterior.chave : crypto.randomUUID(); chaves.current.set(propostaCorrecaoAulaId, { payload, chave });
    setAlvo(`preparar:${propostaCorrecaoAulaId}`); setErro(""); setSucesso("");
    // Chave estável por entrada (acima) e o servidor devolve a revisão existente quando ela se repete
    // (server/financeiro/revisao-correcao-aula.ts:36-39): reenviar os mesmos dados é seguro.
    const d = await executarAcaoCliente(() => proporRevisaoFinanceiraCorrecaoAula({ propostaCorrecaoAulaId, motivo, chaveIdempotencia: chave, ...(tipo ? { tipo } : {}) }), { idempotente: true });
    if (d.tipo !== "ok") { setErro(d.mensagem); return; }
    setSucesso("Revisão preparada. Outra pessoa do Financeiro ou Administração deve decidir."); chaves.current.delete(propostaCorrecaoAulaId); router.refresh();
  });
  const decidir = (propostaId: string, aprovada: boolean, form: HTMLFormElement) => iniciar(async () => {
    setAlvo(`decidir:${propostaId}`); setErro(""); setSucesso("");
    // Decisão sem chave, idempotente por natureza (#166, 7º lote): a repetição idêntica pelo mesmo decisor devolve a
    // decisão gravada (decidirRevisaoFinanceiraCorrecaoAula), então reenviar a mesma decisão é seguro.
    const d = await executarAcaoCliente(() => decidirRevisaoFinanceiraCorrecaoAula({ propostaId, aprovada, motivo: String(new FormData(form).get("motivo") ?? "") }), { idempotente: true });
    if (d.tipo !== "ok") { setErro(d.mensagem); return; }
    setSucesso(aprovada ? "Revisão aprovada; a gestão ainda precisa publicar a correção. Se houver acerto financeiro, ele só acontece nessa publicação." : "Revisão rejeitada; o histórico foi preservado."); router.refresh();
  });
  return <section className="space-y-4">
    {dados.candidatas.map(p => <article key={p.id} className="rounded border p-4 space-y-2">
      <h2 className="font-medium">Correção de presença v{p.versao} · {data(p.encontro.inicio, p.encontro.fusoOrigem)}</h2>
      {p.podePreparar
        ? <form onSubmit={e => { e.preventDefault(); preparar(p.id, e.currentTarget); }} className="space-y-2"><fieldset className="space-y-1"><legend>Tipo da revisão</legend>{p.tiposDisponiveis.map((t, i) => <label key={t.tipo} className="block"><input type="radio" name="tipo" value={t.tipo} defaultChecked={i === 0} disabled={ocupado} /> {t.tipo === "AULA_NAO_COBRAVEL" ? `Aula não devia ser cobrada. ${descreverEfeito(t.efeito) ?? ""}` : "Sem alteração de valores (falta e presença equivalentes)."}</label>)}</fieldset><label className="block">Justificativa financeira<CampoTexto name="motivo" required minLength={5} maxLength={3000} disabled={ocupado} className="block w-full rounded border p-2" /></label><button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Preparar revisão financeira</button></form>
        : <p>{p.preparoBloqueadoPor}</p>}
      {/* Montado só com erro: o FeedbackAcao usa efeito, e o teste de callbacks percorre a árvore fora do React. */}
      {alvo === `preparar:${p.id}` && erro && <FeedbackAcao erro={erro} />}
    </article>)}
    {/* A candidata some da lista depois do preparo; a confirmação fica logo abaixo dela. */}
    <MensagemStatus texto={alvo.startsWith("preparar:") ? sucesso : null} />
    {!dados.candidatas.length && <EstadoVazio>Nenhuma correção de presença pendente nesta matrícula.</EstadoVazio>}
    <h2 className="text-xl">Histórico imutável</h2>
    {!dados.revisoes.length && <EstadoVazio>Nenhuma revisão financeira registrada.</EstadoVazio>}
    {dados.revisoes.map(r => { const naoCobravel = r.tipo === "AULA_NAO_COBRAVEL", foto = Foto.safeParse(r.fotografia), fotoNaoCobravel = FotoNaoCobravel.safeParse(r.fotografia), fotoValida = naoCobravel ? fotoNaoCobravel.success : foto.success, podeDecidir = r.podeDecidir; return <article key={r.id} className="rounded border p-4 space-y-2"><p>Correção de presença v{r.propostaCorrecaoAula.versao} · revisão financeira v{r.versao} · {data(r.propostaCorrecaoAula.encontro.inicio, r.propostaCorrecaoAula.encontro.fusoOrigem)}</p><p>Preparada por {r.preparador.nome}: {r.motivo}</p>{naoCobravel ? (fotoNaoCobravel.success ? <section className="text-sm space-y-1"><p role="status">Aula não devia ser cobrada. {descreverEfeito(fotoNaoCobravel.data.efeito) ?? "Efeito indisponível."} O acerto só acontece quando a gestão pedagógica publicar a correção; o encontro continua como ministrado.</p></section> : <p role="alert">Fotografia histórica indisponível para apresentação; não decida sem nova conferência.</p>) : foto.success ? <section className="text-sm space-y-1"><p>Fundamento financeiro: {rotular(PARTICIPACAO_AULA_LABEL, foto.data.fundamento.participacaoAnterior)} → {rotular(PARTICIPACAO_AULA_LABEL, foto.data.fundamento.participacaoProposta)}; {foto.data.fundamento.ocorrenciaHistoricaTipo ? `ocorrência v${foto.data.ocorrencia?.versao}: ${rotular(TIPO_OCORRENCIA_HORAS_LABEL, foto.data.fundamento.ocorrenciaHistoricaTipo)}; conferência: ${rotular(DESFECHO_OCORRENCIA_HORAS_LABEL, foto.data.fundamento.desfechoHistorico)}.` : `fonte ${foto.data.fundamento.fonte === "DIARIO_REALIZADO" ? "diário realizado" : "ocorrência financeira"}.`}</p><p>{foto.data.fundamento.minutosEquivalentes} minutos · valor preservado {formatarMoeda(foto.data.fundamento.valorPreservado, foto.data.fundamento.moeda)}.</p>{foto.data.reservaConsumida && <p>Reserva consumida {foto.data.reservaConsumida.id} ({foto.data.reservaConsumida.minutos} minutos), consumo {foto.data.reservaConsumida.consumoId}; fonte {foto.data.reservaConsumida.fonte === "DIARIO_REALIZADO" ? "diário realizado" : "conferência financeira"}. A reserva e o consumo históricos não serão regravados.</p>}{foto.data.compraAntecipada && <p>Compra antecipada {foto.data.compraAntecipada.id}: {foto.data.compraAntecipada.minutosComprados} minutos, valor alocado {formatarMoeda(foto.data.compraAntecipada.valorPagoAlocado, foto.data.compraAntecipada.moeda)}.</p>}{foto.data.condicoes && <p>Condições contratuais v{foto.data.condicoes.versao} ({foto.data.condicoes.documentoId}) sustentam a equivalência sem alteração de valores.</p>}<p>{foto.data.cobranca ? `Cobrança ${rotular(STATUS_COBRANCA_LABEL, foto.data.cobranca.status)}; negociado ${formatarMoeda(foto.data.cobranca.valorNegociado, foto.data.cobranca.moeda)}, recebido ${(foto.data.cobranca.valorRecebido != null ? formatarMoeda(foto.data.cobranca.valorRecebido, foto.data.cobranca.moeda) : "não registrado")}, saldo ${(foto.data.cobranca.saldo != null ? formatarMoeda(foto.data.cobranca.saldo, foto.data.cobranca.moeda) : "não registrado")}; crédito ${formatarMoeda(foto.data.cobranca.valorLiquidadoCredito, foto.data.cobranca.moeda)}; permuta ${formatarMoeda(foto.data.cobranca.valorCompensadoPermuta, foto.data.cobranca.moeda)}.` : "Ainda sem item de emissão."}</p><p>Informes: {foto.data.informesPagamento.length ? foto.data.informesPagamento.map(i => rotular(STATUS_PAGAMENTO_INFORMADO_LABEL, i.status)).join(", ") : "nenhum"}. Recebimentos: {foto.data.recebimentos.length}; destinações: {foto.data.destinacoes.map(d => `${rotular(TIPO_DESTINACAO_RECEBIMENTO_LABEL, d.tipo)} ${formatarMoeda(d.valor, foto.data.cobranca?.moeda ?? "")}`).join(", ") || "nenhuma"}.</p></section> : <p role="alert">Fotografia histórica indisponível para apresentação; não decida sem nova conferência.</p>}{!fotoValida && !r.decisao && podeDecidir && <form onSubmit={e => { e.preventDefault(); decidir(r.id, false, e.currentTarget); }} className="space-y-2"><label className="block">Motivo da rejeição<CampoTexto name="motivo" required minLength={5} maxLength={3000} disabled={ocupado} className="block w-full rounded border p-2" /></label><button disabled={ocupado} className={botaoClasses({ variante: "perigo", tamanho: "lg" })}>Rejeitar revisão incompleta</button></form>}{r.decisao ? <p>Decisão: {r.decisao.aprovada ? "aprovada" : "rejeitada"} por {r.decisao.decisor.nome}. {r.decisao.motivo}</p> : podeDecidir && fotoValida ? <form onSubmit={e => { e.preventDefault(); decidir(r.id, true, e.currentTarget); }} className="space-y-2"><label className="block">Motivo da decisão<CampoTexto name="motivo" required minLength={5} maxLength={3000} disabled={ocupado} className="block w-full rounded border p-2" /></label><button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{naoCobravel ? "Aprovar declaração de aula não cobrável" : "Aprovar sem alteração de valores"}</button><button disabled={ocupado} formAction="#" onClick={e => { e.preventDefault(); const form = e.currentTarget.form; if (form) decidir(r.id, false, form); }} className={`${botaoClasses({ variante: "perigo", tamanho: "lg" })} ml-2`}>Rejeitar</button></form> : <p>Outra pessoa com alçada financeira, distinta da preparação e autoria da correção, deve decidir.</p>}{alvo === `decidir:${r.id}` && erro && <FeedbackAcao erro={erro} />}<MensagemStatus texto={alvo === `decidir:${r.id}` ? sucesso : null} /></article>; })}
  </section>;
}
