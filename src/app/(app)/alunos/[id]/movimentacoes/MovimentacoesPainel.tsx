"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { aplicarMovimentacaoContratual } from "@/server/matricula/aplicar-movimentacao";
import { useOperacao } from "./useOperacao";
import { Pendencias } from "./Pendencias";
import { listarPropostasMovimentacao, obterDetalhesMovimentacao } from "@/server/matricula/movimentacoes-consultas";
import { decidirPropostaPausaMatriculas } from "@/server/matricula/pausa-proposta";
import { decidirRetomadaMatriculas } from "@/server/matricula/retomada-proposta";
import { identificacaoContrato } from "./identificacaoContrato";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";

type Lista = NonNullable<Extract<Awaited<ReturnType<typeof listarPropostasMovimentacao>>, { ok: true }>["dado"]>;
type Detalhe = NonNullable<Extract<Awaited<ReturnType<typeof obterDetalhesMovimentacao>>, { ok: true }>["dado"]>;
const botao = "rounded border px-3 py-2 text-sm disabled:opacity-50";
const data = (v: string) => v.slice(0, 10).split("-").reverse().join("/");
const status = { PENDENTE: "Aguardando decisão", APROVADA: "Aprovada; aplicação pendente", REJEITADA: "Rejeitada", APLICADA: "Aplicada" };
const efeito: Record<string, string> = { CONFERIR_COBERTURA: "Conferir cobertura", PRESERVAR_PERIODO_ANTERIOR: "Preservar período anterior", MANTER_PERIODO_INICIADO_INTEGRAL: "Manter período integral", SUSPENDER_PERIODO_FUTURO: "Suspender período futuro" };

export function TituloMovimentacao({ estado, criadoEm, preferenciaFusoExibicao }: { estado: keyof typeof status; criadoEm: string; preferenciaFusoExibicao?: string | null }) {
  const exibicao = formatarInstanteExibicao(criadoEm, preferenciaFusoExibicao, "UTC");
  return <h2 className="font-medium">{status[estado]} · {exibicao.texto} (horário exibido em {exibicao.fuso}; origem UTC)</h2>;
}

export function MovimentacoesPainel({ alunoId, preferenciaFusoExibicao = null }: { alunoId: string; preferenciaFusoExibicao?: string | null }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"PAUSA" | "RETOMADA">("PAUSA");
  const [lista, setLista] = useState<Lista | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [motivoDecisao, setMotivoDecisao] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, iniciar] = useOperacao();
  function carregar(proximo = false) {
    iniciar(async () => {
      setErro(null); setDetalhe(null); setMotivoDecisao(""); setAviso(null);
      try {
        const r = await listarPropostasMovimentacao({ alunoId, tipo, ...(proximo && lista?.proximo ? { cursor: lista.proximo } : {}) });
        if (!r.ok) { setErro(r.erro); return; }
        setLista(r.dado!);
      } catch { setErro("Não foi possível carregar as propostas. Tente novamente."); }
    });
  }
  function abrir(id: string) {
    iniciar(async () => {
      setErro(null); setDetalhe(null); setMotivoDecisao(""); setAviso(null);
      try {
        const r = await obterDetalhesMovimentacao({ alunoId, tipo, propostaId: id });
        if (!r.ok) { setErro(r.erro); return; }
        if (!r.dado) { setErro("Proposta não encontrada ou indisponível."); return; }
        setDetalhe(r.dado);
      } catch { setErro("Não foi possível carregar os impactos. Tente novamente."); }
    });
  }
  function decidir(aprovar: boolean) {
    if (!detalhe) return;
    const id = detalhe.id;
    iniciar(async () => {
      setErro(null); setAviso(null);
      try {
        const acao = tipo === "PAUSA" ? decidirPropostaPausaMatriculas : decidirRetomadaMatriculas;
        const r = await acao(id, { aprovar, motivo: motivoDecisao });
        if (!r.ok) { setErro(r.erro); return; }
        const estado: Detalhe["status"] = aprovar ? "APROVADA" : "REJEITADA";
        if (r.dado?.status !== estado) { setErro("A situação mudou. Consulte novamente a proposta."); return; }
        setMotivoDecisao("");
        setDetalhe((atual) => atual?.id === id ? { ...atual, status: estado } : atual);
        // Remove a possibilidade de decidir de novo sem depender do recarregamento.
        setLista((atual) => atual ? { ...atual, propostas: atual.propostas.map((p) => p.id === id ? { ...p, status: estado, podeDecidir: false } : p) } : atual);
        setAviso(aprovar ? "Aprovação registrada. A aplicação da movimentação permanece pendente." : "Proposta rejeitada. Os contratos e cobranças foram preservados.");
      } catch { setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE); }
    });
  }
  function aplicar() {
    if (!detalhe || detalhe.status !== "APROVADA") return;
    const id = detalhe.id;
    iniciar(async () => {
      setErro(null); setAviso(null);
      try {
        const r = await aplicarMovimentacaoContratual({ alunoId, propostaId: id, tipo });
        if (!r.ok) { setErro(r.erro); return; }
        if (r.dado?.status !== "APLICADA") { setErro("Consulte novamente a situação da proposta."); return; }
        setDetalhe((v) => v?.id === id ? { ...v, status: "APLICADA" } : v);
        setLista((v) => v ? { ...v, propostas: v.propostas.map((p) => p.id === id ? { ...p, status: "APLICADA", podeDecidir: false } : p) } : v);
        setAviso("Movimentação aplicada aos contratos da proposta."); router.refresh();
      } catch { setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE); }
    });
  }
  const impactos = detalhe?.detalhes?.impactos;
  const podeDecidir = !!detalhe && lista?.propostas.some((p) => p.id === detalhe.id && p.podeDecidir) && detalhe.status === "PENDENTE";
  const podeAprovar = !!impactos && !detalhe?.historicoIncompleto && !impactos.matriculas.some((m) => m.pendencias.length > 0);
  return <div className="space-y-4" aria-busy={ocupado}>
    <div className="flex flex-wrap gap-3">
      <label className="text-sm">Tipo de proposta <select className={botao} disabled={ocupado} value={tipo} onChange={(e) => { setTipo(e.target.value as typeof tipo); setLista(null); setDetalhe(null); setErro(null); }}><option value="PAUSA">Pausa</option><option value="RETOMADA">Retomada</option></select></label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado} onClick={() => carregar()}>Consultar propostas</button>
    </div>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
    <MensagemStatus texto={aviso} className="text-green-700" progresso={ocupado ? "Carregando…" : null} />
    {lista?.propostas.length === 0 && <p>Nenhuma proposta encontrada.</p>}
    {lista?.propostas.map((p) => <article key={p.id} className="space-y-2 rounded border p-4">
      <TituloMovimentacao estado={p.status} criadoEm={p.criadoEm} preferenciaFusoExibicao={preferenciaFusoExibicao} />
      <p className="text-sm">Solicitante: {p.solicitante.nome}</p>
      <p className="whitespace-pre-wrap text-sm">{p.motivo}</p>
      <p className="text-sm">Contratos: {p.matriculas.map((m) => identificacaoContrato(m.codigo, m.id)).join(", ")}</p>
      {p.decisor && <p className="text-sm">Decisão de {p.decisor.nome}: {p.motivoDecisao}</p>}
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado} onClick={() => abrir(p.id)}>Conferir impactos</button>
    </article>)}
    {lista?.proximo && <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado} onClick={() => carregar(true)}>Próximas propostas</button>}
    {detalhe && <section className="space-y-3 rounded border p-4" aria-label="Impactos da proposta">
      <h2 className="font-medium">Impactos registrados · {status[detalhe.status]}</h2>
      <p>{detalhe.motivo}</p>
      {detalhe.historicoIncompleto && <p role="alert">O histórico está incompleto e precisa de conferência da equipe.</p>}
      {impactos && <>
        <p>Data proposta: {data("dataEfetiva" in impactos ? impactos.dataEfetiva : impactos.retorno)} · Fuso: {impactos.fusoInstitucional ?? "A conferir"}</p>
        {impactos.matriculas.map((m) => <div key={m.matriculaId} className="space-y-2 border-t pt-3">
          <h3 className="font-medium">Contrato {identificacaoContrato(m.codigo, m.matriculaId)}</h3>
          <Pendencias itens={m.pendencias} />
          {m.periodos.map((p) => <div key={p.cobrancaId} className="rounded bg-gray-50 p-3 text-sm">
            {"cobertura" in p ? <><p>Cobertura anterior: {data(p.coberturaAnterior.inicio)} a {data(p.coberturaAnterior.fim)}</p><p>Cobertura proposta: {data(p.cobertura.inicio)} a {data(p.cobertura.fim)}</p><p>Vencimento: {data(p.vencimentoAnterior)} → {data(p.vencimento)}</p></> : <><p>{p.codigo ?? "Mensalidade"}: {efeito[p.efeito]}</p><p>Cobertura: {p.inicio && p.fim ? `${data(p.inicio)} a ${data(p.fim)}` : "A conferir"}</p><p>Vencimento: {data(p.vencimento)}</p></>}
          </div>)}
          {m.periodos.length === 0 && <p className="text-sm">Nenhum período calculado nesta proposta.</p>}
        </div>)}
      </>}
      {podeDecidir && <div className="space-y-3 border-t pt-4">
        <p className="text-sm">A decisão exige outra pessoa autorizada. Aprovar registra a decisão; a aplicação da movimentação é uma etapa distinta.</p>
        <label className="block text-sm">Motivo da decisão<CampoTexto className="mt-1 block w-full rounded border p-2" rows={3} minLength={5} maxLength={2000} disabled={ocupado} value={motivoDecisao} onChange={(e) => setMotivoDecisao(e.target.value)} /></label>
        <div className="flex flex-wrap gap-3">
          <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado || !podeAprovar || motivoDecisao.trim().length < 5} onClick={() => decidir(true)}>Aprovar proposta</button>
          <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado || motivoDecisao.trim().length < 5} onClick={() => decidir(false)}>Rejeitar proposta</button>
        </div>
        {!podeAprovar && <p className="text-sm text-amber-700">Resolva as pendências ou rejeite esta proposta para uma nova conferência.</p>}
      </div>}
      {detalhe.status === "APROVADA" && <div className="space-y-2 border-t pt-4">
        <p className="text-sm">Aplicar efetiva a pausa ou retomada dos contratos identificados. O servidor confere a data e se os impactos aprovados continuam válidos.</p>
        <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado || !podeAprovar} onClick={aplicar}>Aplicar proposta aprovada</button>
      </div>}
    </section>}
  </div>;
}
