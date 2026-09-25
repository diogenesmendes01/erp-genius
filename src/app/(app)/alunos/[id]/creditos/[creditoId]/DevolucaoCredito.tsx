"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelarDevolucaoCredito, conciliarDevolucaoCredito, decidirDevolucaoCredito, proporDevolucaoCredito, registrarExecucaoDevolucaoCredito } from "@/server/financeiro/devolucao-credito";
import type { consultarPropostasUsoCredito } from "@/server/financeiro/uso-credito-proposta";
import { formatarMoeda, parseMoeda } from "@/lib/dinheiro";
import { CampoMoeda } from "@/components/CampoMoeda";
import { botaoClasses } from "@/components/Botao";

type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarPropostasUsoCredito>>, { ok: true }>["dado"]>;
const estilo = "block rounded border p-2";

export function DevolucaoCredito({ dados }: { dados: Dados }) {
  const [erro, setErro] = useState(""); const [ocupado, iniciar] = useTransition(); const chave = useRef(""); const chavesExecucao = useRef(new Map<string, string>()); const router = useRouter();
  const [valor, setValor] = useState("");
  function enviar(acao: () => Promise<{ ok: boolean; erro?: string }>) { iniciar(async () => { setErro(""); try { const r = await acao(); if (!r.ok) { setErro(r.erro ?? "Não foi possível concluir."); return; } router.refresh(); } catch { setErro("Resultado incerto. Consulte a reserva antes de repetir."); } }); }
  return <section className="space-y-4 border-t pt-4"><h2 className="text-xl font-medium">Devolução de crédito</h2><p>Disponível: {formatarMoeda(dados.valorCredito, dados.moeda)} · reservado: {formatarMoeda(dados.reservaDevolucao, dados.moeda)} · saída confirmada: {formatarMoeda(dados.devolvido, dados.moeda)}. Registrar a operação manualmente não cria recebimento. A aprovação reserva o valor; uma resposta incerta só é encerrada por conciliação com evidência.</p>
    {erro && <p role="alert">{erro}</p>}
    <form onChange={() => { chave.current = ""; }} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); chave.current ||= crypto.randomUUID(); const k = chave.current; enviar(async () => { const numero = parseMoeda(valor); if (numero === null) return { ok: false, erro: "Informe um valor válido, com no máximo duas casas decimais." }; const r = await proporDevolucaoCredito({ creditoId: dados.creditoId, valor: numero.toFixed(2), pedidoAluno: String(f.get("pedidoAluno")), evidenciaPedido: String(f.get("evidenciaPedido")), destino: String(f.get("destino")), motivo: String(f.get("motivo")), chaveIdempotencia: k }); if (r.ok) { chave.current = ""; setValor(""); } return r; }); }}><fieldset disabled={ocupado} className="space-y-2"><legend>Nova proposta de devolução</legend>
      <label className="block">Valor<CampoMoeda className={estilo} name="valor" moeda={dados.moeda} value={valor} onChange={setValor} required /></label>
      <label className="block">Pedido do aluno<textarea className={estilo} name="pedidoAluno" minLength={5} maxLength={2000} required /></label>
      <label className="block">Evidência do pedido<textarea className={estilo} name="evidenciaPedido" minLength={5} maxLength={2000} required /></label>
      <label className="block">Destino conferido<textarea className={estilo} name="destino" minLength={5} maxLength={2000} required /></label>
      <label className="block">Motivo<textarea className={estilo} name="motivo" minLength={5} maxLength={2000} required /></label><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Guardar proposta</button>
    </fieldset></form>
    {dados.devolucoes.map(p => <article key={p.id} className="space-y-2 rounded border p-3"><h3>Devolução {p.versao} · {formatarMoeda(p.valor, dados.moeda)}</h3><p>Destino: {p.destino}</p><p>Pedido: {p.pedidoAluno}</p><p>Evidência: {p.evidenciaPedido}</p>
      {!p.decisao && <p>Aguardando aprovação independente.</p>}{p.decisao && <p>Decisão: {p.decisao.aprovada ? "aprovada" : "rejeitada"} · {p.decisao.motivo}</p>}
      {p.podeDecidir && <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); enviar(() => decidirDevolucaoCredito({ propostaId: p.id, aprovar: f.get("decisao") === "aprovar", motivo: String(f.get("motivo")) })); }}><fieldset disabled={ocupado} className="space-y-2"><label className="block">Decisão<select name="decisao" defaultValue="" required className={estilo}><option value="" disabled>Selecione</option><option value="aprovar">Aprovar e reservar</option><option value="rejeitar">Rejeitar</option></select></label><label className="block">Justificativa<textarea name="motivo" minLength={5} maxLength={2000} required className={estilo} /></label><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Confirmar decisão</button></fieldset></form>}
      {p.decisao?.reserva && <Reserva dados={p} ocupado={ocupado} enviar={enviar} chavesExecucao={chavesExecucao.current} />}
    </article>)}
  </section>;
}

function Reserva({ dados: p, ocupado, enviar, chavesExecucao }: { dados: Dados["devolucoes"][number]; ocupado: boolean; enviar: (acao: () => Promise<{ ok: boolean; erro?: string }>) => void; chavesExecucao: Map<string, string> }) {
  const r = p.decisao!.reserva!;
  return <div className="space-y-2 rounded bg-muted p-2"><p>Reserva: {r.estado}{r.referenciaExterna ? ` · referência ${r.referenciaExterna}` : ""}</p>{r.evidenciaExecucao && <p>Comprovante: {r.evidenciaExecucao}</p>}
    {r.cancelamento && <p>Cancelamento: {r.cancelamento.motivo} · {r.cancelamento.evidencia}</p>}{r.conciliacoes.map((c, i) => <p key={i}>Conciliação: {c.confirmouSaida ? "saída confirmada" : "reserva liberada"} · {c.evidencia}</p>)}
    {p.podeCancelar && r.estado === "AGUARDANDO_EXECUCAO" && <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); enviar(() => cancelarDevolucaoCredito({ reservaId: r.id, motivo: String(f.get("motivo")), evidenciaCancelamento: String(f.get("evidencia")) })); }}><fieldset disabled={ocupado} className="space-y-2"><label className="block">Cancelar reserva<input className={estilo} name="motivo" minLength={5} required placeholder="Motivo" /></label><label className="block">Evidência<textarea className={estilo} name="evidencia" minLength={5} required /></label><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Cancelar e liberar reserva</button></fieldset></form>}
    {p.podeExecutar && r.estado === "AGUARDANDO_EXECUCAO" && <form onChange={() => chavesExecucao.delete(r.id)} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const chave = chavesExecucao.get(r.id) ?? crypto.randomUUID(); chavesExecucao.set(r.id, chave); enviar(async () => { const resultado = await registrarExecucaoDevolucaoCredito({ reservaId: r.id, resultado: String(f.get("resultado")) as "CONFIRMADA" | "INCERTO", referenciaExterna: String(f.get("referencia")), evidenciaExecucao: String(f.get("evidencia")), chaveIdempotencia: chave }); if (resultado.ok) chavesExecucao.delete(r.id); return resultado; }); }}><fieldset disabled={ocupado} className="space-y-2"><label className="block">Resultado<select className={estilo} name="resultado"><option value="CONFIRMADA">Saída confirmada manualmente</option><option value="INCERTO">Resposta externa incerta</option></select></label><label className="block">Referência externa<input className={estilo} name="referencia" minLength={1} required /></label><label className="block">Comprovante<textarea className={estilo} name="evidencia" minLength={5} required /></label><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Registrar execução</button></fieldset></form>}
    {p.podeConciliar && r.estado === "INCERTO" && <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); enviar(() => conciliarDevolucaoCredito({ reservaId: r.id, confirmouSaida: f.get("resultado") === "confirmar", evidenciaConciliacao: String(f.get("evidencia")) })); }}><fieldset disabled={ocupado} className="space-y-2"><label className="block">Conciliação<select className={estilo} name="resultado"><option value="confirmar">Confirmar saída</option><option value="liberar">Liberar reserva</option></select></label><label className="block">Evidência<textarea className={estilo} name="evidencia" minLength={5} required /></label><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Conciliar resultado</button></fieldset></form>}
  </div>;
}
