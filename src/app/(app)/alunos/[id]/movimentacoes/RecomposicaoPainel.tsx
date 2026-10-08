"use client";
import { useRef, useState } from "react";
import { z } from "zod";
import { formatarMoeda } from "@/lib/dinheiro";
import { EntradaRecomposicao } from "@/server/matricula/recomposicao-schema";
import { preverRecomposicaoCobertura } from "@/server/matricula/recomposicao-previa";
import { consultarRascunhoRecomposicao, salvarRascunhoRecomposicao } from "@/server/matricula/recomposicao-rascunho";
import { conferirValidadeRascunhoRecomposicao } from "@/server/matricula/recomposicao-validade";
import { decidirRecomposicaoCobertura } from "@/server/matricula/recomposicao-decisao";
import { aplicarRecomposicaoCobertura } from "@/server/matricula/recomposicao-aplicar";
import type { consultarContextoEncerramento } from "@/server/matricula/encerramento-contexto";
import type { Resultado } from "@/server/_shared/resultado";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { formatarDataCivil } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";

type Contexto = NonNullable<Extract<Awaited<ReturnType<typeof consultarContextoEncerramento>>, { ok: true }>["dado"]>;
type Rascunho = NonNullable<Extract<Awaited<ReturnType<typeof consultarRascunhoRecomposicao>>, { ok: true }>["dado"]>;
const resumo = z.object({ proposta: z.object({ quantidadeDias: z.number(), compensacao: z.object({ inicio: z.string(), fim: z.string() }), periodos: z.array(z.object({ cobrancaId: z.string(), valor: z.string(), vencimento: z.string(), cobertura: z.object({ inicio: z.string(), fim: z.string() }) })) }) });
function Resumo({ dados }: { dados: unknown }) {
  const r = resumo.safeParse(dados);
  if (!r.success) return <p>Resumo indisponível para esta versão.</p>;
  return <div><p>{r.data.proposta.quantidadeDias} dias de compensação: {formatarDataCivil(r.data.proposta.compensacao.inicio)} a {formatarDataCivil(r.data.proposta.compensacao.fim)}, sem cobrança adicional.</p><ul>{r.data.proposta.periodos.map((p) => <li key={p.cobrancaId}>Mensalidade {p.cobrancaId}: {formatarDataCivil(p.cobertura.inicio)} a {formatarDataCivil(p.cobertura.fim)}; valor {formatarMoeda(p.valor, "")}; vencimento {formatarDataCivil(p.vencimento)}.</li>)}</ul></div>;
}

export function RecomposicaoPainel({ contexto, usuarioId, podeAprovar, atualizarContexto }: { contexto: Contexto; usuarioId: string; podeAprovar: boolean; atualizarContexto: () => Promise<void> }) {
  // Um grupo de ação por bloco da tela, cada um com o resultado junto dos próprios botões. Todos como
  // sem chave na falha de transporte (MSG_RESULTADO_INCERTO_SEM_CHAVE), como antes: conferir antes de repetir.
  const consulta = useAcaoCliente({ idempotente: false });
  // Conferir atualidade, aplicar a programação e decidir: as ações sobre o rascunho exibido.
  const conferencia = useAcaoCliente({ idempotente: false });
  const preparacao = useAcaoCliente({ idempotente: false });
  const salvamento = useAcaoCliente({ idempotente: false });
  const ocupado = consulta.ocupado || conferencia.ocupado || preparacao.ocupado || salvamento.ocupado;
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [entrada, setEntrada] = useState<z.output<typeof EntradaRecomposicao> | null>(null);
  const [previa, setPrevia] = useState<unknown>(null);
  const chave = useRef("");
  const estilo = "rounded border p-2 text-sm";
  const mensalidades = contexto.cobrancas.filter((c) => c.tipo === "MENSALIDADE" && c.status !== "CANCELADA");
  const direitos = contexto.compensacoes.filter((c) => c.status === "APROVADA").flatMap((c) => c.dias).filter((d) => d.estado === "PENDENTE" && !d.programacao);
  const base = { alunoId: contexto.alunoId, matriculaId: contexto.matriculaId };
  async function carregar(): Promise<Resultado> {
    const r = await consultarRascunhoRecomposicao(base);
    if (!r.ok) return r;
    setRascunho(r.dado ?? null); setCarregado(true);
    return { ok: true };
  }
  return <section className="space-y-3 border-t pt-3" aria-label="Recomposição de cobertura">
    <h3 className="font-medium">Recomposição de cobertura</h3>
    <p>Revise a cobertura de todas as mensalidades. A proposta preserva valores e vencimentos; aprovação e aplicação permanecem identificadas separadamente.</p>
    <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado} onClick={() => consulta.executar(carregar)}>Consultar rascunho de recomposição</button>
    <FeedbackAcao erro={consulta.erro} />
    {rascunho && <div className="space-y-2 rounded border p-3"><p>Versão {rascunho.versao} · preparada por {rascunho.preparador.nome}</p><Resumo dados={rascunho.snapshot} />
      <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado} onClick={async () => {
        const d = await conferencia.executar(() => conferirValidadeRascunhoRecomposicao({ ...base, rascunhoId: rascunho.id }), (dado) => dado ? (dado.atual ? "Origens atuais conferidas. Isso não aprova a proposta." : dado.motivos.join(" ")) : null);
        if (d?.tipo === "ok" && !d.dado) conferencia.setErro("Conferência indisponível.");
      }}>Conferir atualidade</button>
      {rascunho.decisao ? <div><p>{rascunho.decisao.aprovada ? "Aprovada" : "Rejeitada"} por {rascunho.decisao.decisor.nome}: {rascunho.decisao.motivo}</p>{rascunho.decisao.aplicacao && <p>Programação aplicada. O cumprimento dos dias é acompanhado separadamente.</p>}{rascunho.decisao.aprovada && !rascunho.decisao.aplicacao && <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} type="button" disabled={ocupado} onClick={() => conferencia.executar(async (): Promise<Resultado> => { const r = await aplicarRecomposicaoCobertura({ ...base, decisaoId: rascunho.decisao!.id }); if (!r.ok) return r; setEntrada(null); setPrevia(null); const c = await carregar(); if (!c.ok) return c; await atualizarContexto(); return { ok: true }; }, "Programação aplicada. Atualize as compensações para ver as datas. Cumprimento ainda não confirmado.")}>Aplicar programação aprovada</button>}</div> : rascunho.preparador.id === usuarioId ? <p>Outra pessoa precisa decidir esta versão.</p> : podeAprovar && <form onSubmit={async (e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget);
        await conferencia.executar(async (): Promise<Resultado> => { const r = await decidirRecomposicaoCobertura({ ...base, rascunhoId: rascunho.id, aprovar: f.get("decisao") === "aprovar", motivo: String(f.get("motivo") ?? "") }); if (!r.ok) return r; return carregar(); });
      }}><fieldset disabled={ocupado} className="space-y-2"><label className="grid">Decisão da recomposição<select className={estilo} name="decisao"><option value="aprovar">Aprovar</option><option value="rejeitar">Rejeitar</option></select></label><label className="grid">Motivo da decisão<CampoTexto className={estilo} name="motivo" required minLength={5} maxLength={2000} /></label><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Registrar decisão da recomposição</button></fieldset></form>}
      <FeedbackAcao erro={conferencia.erro} sucesso={conferencia.sucesso} />
    </div>}
    {carregado && <form key={JSON.stringify(mensalidades.map((c) => [c.id, c.versao, c.coberturaInicio, c.coberturaFim]))} className="space-y-2" onChange={() => { setEntrada(null); setPrevia(null); chave.current = ""; }} onSubmit={async (e) => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      const r = EntradaRecomposicao.safeParse({ ...base, retornoOferta: f.get("retorno"), inicioCompensacao: f.get("inicio"), motivo: f.get("motivo"), evidenciaCondicoes: f.get("evidencia"), direitosIds: f.getAll("direito"), periodosPropostos: mensalidades.map((c) => ({ cobrancaId: c.id, cobertura: { inicio: f.get(`${c.id}:inicio`), fim: f.get(`${c.id}:fim`) } })) });
      if (!r.success) { preparacao.setErro("Confira as datas, selecione os direitos e preencha motivo e evidência com ao menos cinco caracteres."); return; }
      await preparacao.executar(async (): Promise<Resultado> => { const p = await preverRecomposicaoCobertura(r.data); if (!p.ok) return p; setEntrada(r.data); setPrevia(p.dado); return { ok: true }; });
    }}><fieldset disabled={ocupado} className="space-y-2"><legend>Preparar nova versão</legend>
      {direitos.length ? direitos.map((d) => <label key={d.id} className="block"><input type="checkbox" name="direito" value={d.id} /> Dia devido de {d.diaOrigem}</label>) : <EstadoVazio>Nenhum direito disponível sem programação.</EstadoVazio>}
      <label className="grid">Retorno da oferta<input type="date" name="retorno" required className={estilo} /></label><label className="grid">Início dos dias de compensação<input type="date" name="inicio" required className={estilo} /></label>
      {mensalidades.map((c) => <div key={c.id}><p>Mensalidade {c.id} · atual: {formatarDataCivil(c.coberturaInicio, "pendente")} a {formatarDataCivil(c.coberturaFim, "pendente")}</p><label className="grid">Início proposto — {c.id}<input type="date" name={`${c.id}:inicio`} defaultValue={formatarDataCivil(c.coberturaInicio, "")} required className={estilo} /></label><label className="grid">Fim proposto — {c.id}<input type="date" name={`${c.id}:fim`} defaultValue={formatarDataCivil(c.coberturaFim, "")} required className={estilo} /></label></div>)}
      <label className="grid">Motivo da recomposição<CampoTexto name="motivo" required minLength={5} maxLength={2000} className={estilo} /></label><label className="grid">Evidência das condições<CampoTexto name="evidencia" required minLength={5} maxLength={2000} className={estilo} /></label><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={!direitos.length}>Conferir proposta de recomposição</button>
    </fieldset><FeedbackAcao erro={preparacao.erro} /></form>}
    {previa != null && entrada && <div className="space-y-2"><Resumo dados={previa} /><button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado} onClick={() => salvamento.executar(async (): Promise<Resultado> => { chave.current ||= crypto.randomUUID(); const r = await salvarRascunhoRecomposicao({ ...entrada, versaoAnterior: rascunho?.versao ?? 0, chaveIdempotencia: chave.current }); if (!r.ok) return r; setEntrada(null); setPrevia(null); chave.current = ""; return carregar(); }, "Nova versão salva para decisão independente.")}>Salvar versão da recomposição</button></div>}
    {/* Fora do bloco da prévia: depois de salvar, a prévia some e a confirmação continua visível. */}
    <FeedbackAcao erro={salvamento.erro} sucesso={salvamento.sucesso} />
  </section>;
}
