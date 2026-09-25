"use client";

import { useRef, useState } from "react";
import { consultarCumprimentosRecomposicao, prepararCumprimentoRecomposicao, decidirCumprimentoRecomposicao } from "@/server/matricula/recomposicao-cumprimento";
import { useOperacao } from "./useOperacao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { formatarDataCivil } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";

type Dias = NonNullable<Extract<Awaited<ReturnType<typeof consultarCumprimentosRecomposicao>>, { ok: true }>["dado"]>;
type Props = { alunoId: string; matriculaId: string; usuarioId: string; podeAprovar: boolean; atualizarContexto: () => Promise<void>; preferenciaFusoExibicao?: string | null };
const estilo = "rounded border p-2 text-sm";
const estados = { PENDENTE: "Cumprimento pendente", RECOMPOSTO: "Cobertura cumprida", LIQUIDADO_FINANCEIRAMENTE: "Direito acertado financeiramente" };

export function DecisaoCumprimentoHistorico({ decisor, motivo, decididaEm, preferenciaFusoExibicao }: { decisor: string | null | undefined; motivo: string | null | undefined; decididaEm: string; preferenciaFusoExibicao?: string | null }) {
  const exibicao = formatarInstanteExibicao(decididaEm, preferenciaFusoExibicao, "UTC");
  return <p>Decisão de {decisor}: {motivo} · {exibicao.texto} (horário exibido em {exibicao.fuso}; origem UTC)</p>;
}

function Dia({ dia, alunoId, matriculaId, usuarioId, podeAprovar, atualizar, preferenciaFusoExibicao }: Props & { dia: Dias[number]; atualizar: () => Promise<void> }) {
  const [ocupado, iniciar] = useOperacao();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aprovar, setAprovar] = useState(true);
  const chave = useRef("");
  const pendente = dia.conferencias.find((c) => c.status === "PENDENTE");
  async function executar(acao: () => Promise<{ ok: boolean; erro?: string }>, sucesso: string) {
    setErro(null); setAviso(null);
    try {
      const r = await acao();
      if (!r.ok) { setErro(r.erro ?? "Não foi possível registrar."); return; }
      setAviso(sucesso);
      try { await atualizar(); } catch { setErro("Registro salvo, mas a consulta falhou. Atualize os cumprimentos antes de continuar."); }
    } catch { setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE); }
  }
  return <article className="space-y-2 rounded border p-3" aria-label={`Cobertura de ${formatarDataCivil(dia.dataCobertura)}`}>
    <h4 className="font-medium">Cobertura de {formatarDataCivil(dia.dataCobertura)} · {estados[dia.estado]}</h4>
    <p>Compensa o dia {dia.diaOrigem} sem oferta da escola.</p>
    {dia.conferencias.map((c) => <div key={c.id} className="border-l pl-3">
      <p>Preparação: {c.preparador.nome} · {c.status === "PENDENTE" ? "Aguardando decisão" : c.status === "APROVADA" ? "Aprovada" : "Rejeitada"}</p>
      <p>Motivo: {c.motivo}</p><p>Evidência: {c.evidencia}</p>
      {c.decididaEm && <DecisaoCumprimentoHistorico decisor={c.decisor?.nome} motivo={c.motivoDecisao} decididaEm={c.decididaEm} preferenciaFusoExibicao={preferenciaFusoExibicao} />}
    </div>)}
    {dia.estado === "PENDENTE" && !pendente && <form className="space-y-2" onChange={() => { chave.current = ""; }} onSubmit={(e) => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      void iniciar(async () => {
        chave.current ||= crypto.randomUUID();
        await executar(() => prepararCumprimentoRecomposicao({ alunoId, matriculaId, programacaoId: dia.id,
          motivo: String(f.get("motivo") ?? ""), evidencia: String(f.get("evidencia") ?? ""), chaveIdempotencia: chave.current }), "Conferência enviada para decisão independente.");
      });
    }}><fieldset disabled={ocupado} className="space-y-2">
      <legend>Registrar cobertura efetivamente oferecida</legend>
      <p>A conferência só pode ser preparada após terminar o dia no fuso da escola.</p>
      <label className="grid gap-1">Motivo da conferência<textarea className={estilo} name="motivo" required minLength={5} maxLength={2000} /></label>
      <label className="grid gap-1">Evidência da oferta efetiva<textarea className={estilo} name="evidencia" required minLength={5} maxLength={2000} /></label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Enviar conferência de cumprimento</button>
    </fieldset></form>}
    {pendente && (pendente.preparadorId === usuarioId ? <p>Outra pessoa precisa decidir esta conferência.</p> : !podeAprovar ? <p>A decisão exige permissão de aprovação financeira ou Administração.</p> : <form className="space-y-2" onSubmit={(e) => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      void iniciar(() => executar(() => decidirCumprimentoRecomposicao({ alunoId, matriculaId, conferenciaId: pendente.id, aprovar,
        motivo: String(f.get("motivo") ?? ""), evidenciaConferida: f.get("evidenciaConferida") === "on" }), aprovar ? "Cumprimento aprovado e direito compensado." : "Conferência rejeitada; direito permanece pendente."));
    }}><fieldset disabled={ocupado} className="space-y-2">
      <label className="grid gap-1">Decisão de cumprimento<select className={estilo} value={aprovar ? "aprovar" : "rejeitar"} onChange={(e) => setAprovar(e.target.value === "aprovar")}><option value="aprovar">Aprovar cumprimento</option><option value="rejeitar">Rejeitar conferência</option></select></label>
      {aprovar && <label className="flex gap-2"><input type="checkbox" name="evidenciaConferida" required />Conferi a evidência de que a escola efetivamente ofereceu esta cobertura.</label>}
      <label className="grid gap-1">Justificativa da decisão de cumprimento<textarea className={estilo} name="motivo" required minLength={5} maxLength={2000} /></label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Registrar decisão de cumprimento</button>
    </fieldset></form>)}
    {erro && <p role="alert">{erro}</p>}<MensagemStatus texto={aviso} />
  </article>;
}

export function CumprimentoPainel(props: Props) {
  const [dias, setDias] = useState<Dias | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useOperacao();
  async function carregar() {
    const r = await consultarCumprimentosRecomposicao({ alunoId: props.alunoId, matriculaId: props.matriculaId });
    if (!r.ok || !r.dado) throw new Error(r.ok ? "Consulta indisponível." : r.erro);
    setDias(r.dado);
  }
  return <section className="space-y-3" aria-label="Cumprimento da cobertura compensatória">
    <h3 className="font-medium">Conferir cumprimento da cobertura</h3>
    <p>Os dias programados continuam devidos até a conferência independente do serviço oferecido.</p>
    <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado} onClick={() => { void iniciar(async () => { setErro(null); try { await carregar(); } catch (e) { setErro(e instanceof Error ? e.message : "Falha na consulta."); } }); }}>Atualizar cumprimentos</button>
    {erro && <p role="alert">{erro}</p>}
    {dias?.length === 0 && <p>Nenhum dia de compensação programado para esta matrícula.</p>}
    {dias?.map((dia) => <Dia key={dia.id} {...props} dia={dia} atualizar={async () => { await carregar(); await props.atualizarContexto(); }} />)}
  </section>;
}
