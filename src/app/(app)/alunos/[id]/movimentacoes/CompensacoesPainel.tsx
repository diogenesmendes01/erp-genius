"use client";

import { useRef, useState } from "react";
import { consultarContextoEncerramento } from "@/server/matricula/encerramento-contexto";
import { prepararCompensacaoCobertura, decidirCompensacaoCobertura } from "@/server/matricula/compensacao-cobertura";
import { CompensacoesEncerramento } from "./CompensacoesEncerramento";
import { useOperacao } from "./useOperacao";
import { RecomposicaoPainel } from "./RecomposicaoPainel";
import { CumprimentoPainel } from "./CumprimentoPainel";
import { MensagemStatus } from "@/components/MensagemStatus";
import { formatarMoeda } from "@/lib/dinheiro";
import { formatarDataCivil } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";

type Contexto = NonNullable<Extract<Awaited<ReturnType<typeof consultarContextoEncerramento>>, { ok: true }>["dado"]>;
const estilo = "rounded border p-2 text-sm";

function Decisao({ proposta, usuarioId, podeAprovar, atualizar }: {
  proposta: Contexto["compensacoes"][number]; usuarioId: string; podeAprovar: boolean; atualizar: () => Promise<void>;
}) {
  const [ocupado, iniciar] = useOperacao();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aprovar, setAprovar] = useState(true);
  const dias = Array.isArray(proposta.diasPropostos) ? proposta.diasPropostos.filter((d): d is string => typeof d === "string") : [];
  return <div className="space-y-2 rounded border p-3">
    <p>Proposta {proposta.id} · cobrança {proposta.cobrancaOrigemId}</p>
    <p>Dias propostos: {dias.join(", ") || "Informação incompleta; conferir origem."}</p>
    <p>Motivo: {proposta.motivo}. Condições: {proposta.evidenciaCondicoes}</p>
    {proposta.preparadorId === usuarioId ? <p>Outra pessoa precisa decidir esta proposta.</p> : !podeAprovar ? <p>A decisão exige permissão específica do Financeiro ou Administração.</p> : <form className="space-y-2" onSubmit={(e) => {
      e.preventDefault(); const motivo = String(new FormData(e.currentTarget).get("motivo") ?? "");
      void iniciar(async () => {
        setErro(null); setAviso(null);
        try {
          const r = await decidirCompensacaoCobertura({ id: proposta.id, aprovar, motivo });
          if (!r.ok) { setErro(r.erro); return; }
          setAviso(aprovar ? "Dias aprovados. Recomposição e acerto financeiro continuam em etapas próprias." : "Proposta rejeitada.");
          try { await atualizar(); } catch { setErro("Decisão registrada, mas a consulta não foi atualizada. Carregue as compensações novamente."); }
        } catch { setErro("Resultado incerto. Atualize a consulta antes de repetir a decisão."); }
      });
    }}><fieldset disabled={ocupado} className="space-y-2">
      <label className="grid gap-1">Decisão<select className={estilo} value={aprovar ? "aprovar" : "rejeitar"} onChange={(e) => setAprovar(e.target.value === "aprovar")}><option value="aprovar">Aprovar dias de compensação</option><option value="rejeitar">Rejeitar proposta</option></select></label>
      <label className="grid gap-1">Justificativa da decisão<textarea className={estilo} name="motivo" required minLength={5} maxLength={2000} /></label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Registrar decisão</button>
    </fieldset></form>}
    {erro && <p role="alert">{erro}</p>}<MensagemStatus texto={aviso} />
  </div>;
}

export function CompensacoesPainel({ alunoId, contratos, usuarioId, podeAprovar, preferenciaFusoExibicao = null }: {
  alunoId: string; contratos: { id: string; codigo: string | null }[]; usuarioId: string; podeAprovar: boolean; preferenciaFusoExibicao?: string | null;
}) {
  const [ocupado, iniciar] = useOperacao();
  const [contexto, setContexto] = useState<Contexto | null>(null);
  const [matriculaId, setMatriculaId] = useState(contratos[0]?.id ?? "");
  const [cobrancaId, setCobrancaId] = useState("");
  const [dias, setDias] = useState<string[]>([]);
  const [dia, setDia] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const chave = useRef("");
  const selecao = useRef(matriculaId);
  async function atualizar() {
    const r = await consultarContextoEncerramento({ alunoId, matriculaId });
    if (!r.ok || !r.dado) throw new Error(r.ok ? "Consulta indisponível." : r.erro);
    if (selecao.current === matriculaId) setContexto(r.dado);
  }
  const cobranca = contexto?.cobrancas.find((c) => c.id === cobrancaId);
  return <section className="space-y-3 rounded border p-3" aria-label="Compensações por falta de oferta">
    <h2 className="text-lg font-medium">Compensações por falta de oferta da escola</h2>
    <p>Registre dias de indisponibilidade em parte de um período. Aprovar os dias reconhece o direito; extensão de cobertura e acerto financeiro exigem seus próprios fluxos.</p>
    <label className="grid gap-1">Contrato para compensação<select className={estilo} disabled={ocupado} value={matriculaId} onChange={(e) => { selecao.current = e.target.value; setMatriculaId(e.target.value); setContexto(null); setCobrancaId(""); setDias([]); setErro(null); setAviso(null); chave.current = ""; }}>{contratos.map((c) => <option key={c.id} value={c.id}>{c.codigo ?? c.id}</option>)}</select></label>
    <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado || !matriculaId} onClick={() => { void iniciar(async () => { setErro(null); try { await atualizar(); } catch (e) { setErro(e instanceof Error ? e.message : "Falha na consulta."); } }); }}>Carregar compensações</button>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}<MensagemStatus texto={aviso} />
    {contexto && <>
      <CompensacoesEncerramento compensacoes={contexto.compensacoes} />
      <RecomposicaoPainel key={contexto.matriculaId} contexto={contexto} usuarioId={usuarioId} podeAprovar={podeAprovar} atualizarContexto={atualizar} />
      <CumprimentoPainel key={`cumprimento-${contexto.matriculaId}`} alunoId={alunoId} matriculaId={contexto.matriculaId} usuarioId={usuarioId} podeAprovar={podeAprovar} atualizarContexto={atualizar} preferenciaFusoExibicao={preferenciaFusoExibicao} />
      {contexto.compensacoes.filter((c) => c.status === "PENDENTE").map((c) => <Decisao key={c.id} proposta={c} usuarioId={usuarioId} podeAprovar={podeAprovar} atualizar={atualizar} />)}
      <form className="space-y-2" onChange={() => { chave.current = ""; }} onSubmit={(e) => {
        e.preventDefault(); if (!cobranca || !dias.length) { setErro("Escolha a mensalidade e adicione os dias sem oferta."); return; }
        const form = e.currentTarget; const f = new FormData(form);
        void iniciar(async () => {
          setErro(null); setAviso(null); chave.current ||= crypto.randomUUID();
          try {
            const r = await prepararCompensacaoCobertura({ matriculaId: contexto.matriculaId, cobrancaId: cobranca.id, versaoCobranca: cobranca.versao, dias, motivo: String(f.get("motivo") ?? ""), evidenciaCondicoes: String(f.get("evidencia") ?? ""), chaveIdempotencia: chave.current });
            if (!r.ok) { setErro(r.erro); return; }
            setAviso("Proposta registrada para decisão de outra pessoa autorizada."); form.reset(); setDias([]); chave.current = "";
            try { await atualizar(); } catch { setErro("Proposta registrada, mas a consulta não foi atualizada. Carregue as compensações novamente."); }
          } catch { setErro("Resultado incerto. Repita sem alterar os dados para recuperar a mesma proposta."); }
        });
      }}><fieldset disabled={ocupado} className="space-y-2">
        <legend className="font-medium">Preparar proposta</legend>
        <label className="grid gap-1">Mensalidade de origem<select className={estilo} required value={cobrancaId} onChange={(e) => { setCobrancaId(e.target.value); setDias([]); }}><option value="">Selecione</option>{contexto.cobrancas.filter((c) => c.tipo === "MENSALIDADE" && c.status !== "CANCELADA" && c.coberturaInicio && c.coberturaFim).map((c) => <option key={c.id} value={c.id}>{formatarDataCivil(c.coberturaInicio)} a {formatarDataCivil(c.coberturaFim)} · {formatarMoeda(c.valorNegociado, c.moeda)} · {c.id}</option>)}</select></label>
        <label className="grid gap-1">Dia sem oferta<input type="date" className={estilo} value={dia} min={cobranca?.coberturaInicio ?? undefined} max={cobranca?.coberturaFim ?? undefined} onChange={(e) => setDia(e.target.value)} /></label>
        <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={() => { if (!dia || !cobranca?.coberturaInicio || !cobranca.coberturaFim || dia < cobranca.coberturaInicio || dia > cobranca.coberturaFim) { setErro("Selecione um dia da cobertura original."); return; } setDias((atual) => [...new Set([...atual, dia])].sort()); chave.current = ""; setErro(null); }}>Adicionar dia</button>
        <ul>{dias.map((d) => <li key={d}>{d} <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={() => { setDias((atual) => atual.filter((v) => v !== d)); chave.current = ""; }}>Remover {d}</button></li>)}</ul>
        <label className="grid gap-1">Motivo da indisponibilidade<textarea className={estilo} name="motivo" required minLength={5} maxLength={2000} /></label>
        <label className="grid gap-1">Evidência das condições de compensação<textarea className={estilo} name="evidencia" required minLength={5} maxLength={2000} /></label>
        <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Enviar proposta para aprovação</button>
      </fieldset></form>
    </>}
  </section>;
}
