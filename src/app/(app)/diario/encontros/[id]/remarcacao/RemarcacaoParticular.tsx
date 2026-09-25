"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { consultarRemarcacoesParticular, proporRemarcacaoParticular, decidirRemarcacaoParticular } from "@/server/agenda/remarcacao-particular";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarRemarcacoesParticular>>, { ok: true }>["dado"]>;
const estilo = "block rounded border p-2";
export function RemarcacaoParticular({ encontroOriginalId, dados, fusoExibicao }: { encontroOriginalId: string; dados: Dados; fusoExibicao: string }) {
  const [erro, setErro] = useState(""); const [ocupado, iniciar] = useTransition(); const chave = useRef(""); const router = useRouter();
  async function executar(acao: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(""); try { const r = await acao(); if (!r.ok) { setErro(r.erro ?? "Operação não aplicada."); return; } chave.current = ""; router.refresh(); }
    catch { setErro(MSG_RESULTADO_INCERTO); }
  }
  return <div className="space-y-4"><p>Duração preservada: {dados.duracaoMinutos} minutos.</p>{erro && <p role="alert">{erro}</p>}
    {dados.podePropor && <form onChange={() => { chave.current = ""; }} onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget); chave.current ||= crypto.randomUUID(); const chaveIdempotencia = chave.current;
      iniciar(() => executar(() => proporRemarcacaoParticular({ encontroOriginalId, professorId: String(f.get("professor")), data: String(f.get("data")), horario: String(f.get("horario")), fuso: String(f.get("fuso")), evidenciaEscolha: String(f.get("escolha")), motivo: String(f.get("motivo")), motivoExcecaoNaoLetiva: String(f.get("excecao") ?? "").trim() || undefined, chaveIdempotencia })));
    }}><fieldset disabled={ocupado} className="space-y-2"><legend>Proposta de novo encontro</legend>
      <label className="block">Professor<select required name="professor" className={estilo} defaultValue=""><option value="" disabled>Selecione</option>{dados.professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label className="block">Data no fuso informado<input type="date" name="data" required className={estilo} /></label>
      <label className="block">Horário<input type="time" name="horario" required className={estilo} /></label>
      <label className="block">Fuso do encontro<input name="fuso" required defaultValue={dados.fuso} className={estilo} /></label>
      <label className="block">Evidência da escolha do aluno<CampoTexto name="escolha" required minLength={5} maxLength={2000} className={estilo} /></label>
      <label className="block">Motivo<CampoTexto name="motivo" required minLength={5} maxLength={2000} className={estilo} /></label>
      <label className="block">Justificativa de exceção em dia não letivo, se necessária<CampoTexto name="excecao" minLength={5} maxLength={2000} className={estilo} /></label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Conferir e submeter proposta</button>
    </fieldset></form>}
    {dados.propostas.map(p => <article key={p.id} className="space-y-2 rounded border p-3">
      <p>{p.entrada.data} às {p.entrada.horario} · {p.entrada.fuso}</p><p>Professor: {dados.professores.find(x => x.id === p.entrada.professorId)?.nome ?? p.entrada.professorId}</p>
      <p>{p.entrada.evidenciaEscolha}</p><p>{p.entrada.motivo}</p>
      {p.entrada.motivoExcecaoNaoLetiva && <p>Exceção não letiva incluída na aprovação: {p.entrada.motivoExcecaoNaoLetiva}</p>}
      {p.conferencia && <><p>Intervalo conferido: {formatarInstanteExibicao(p.conferencia.inicio, fusoExibicao, p.entrada.fuso).texto} até {formatarInstanteExibicao(p.conferencia.fim, fusoExibicao, p.entrada.fuso).texto} ({fusoExibicao}).</p>
        {!!p.conferencia.periodos.length && <p>Períodos não letivos atingidos: {p.conferencia.periodos.join(", ")}.</p>}{p.conferencia.pendencias.map(x => <p role="alert" key={x}>{x}</p>)}</>}
      {p.erroConferencia && <p role="alert">{p.erroConferencia}</p>}
      {p.decisao ? <p>{p.decisao.aprovada ? "Remarcação publicada" : "Proposta rejeitada"}: {p.decisao.motivo} {p.decisao.encontroNovoId && <Link className="underline" href={`/diario/encontros/${p.decisao.encontroNovoId}/cancelamento`}>Consultar novo encontro</Link>}</p> : <p>Aguardando decisão independente.</p>}
      {p.podeDecidir && <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget);
        iniciar(() => executar(() => decidirRemarcacaoParticular({ propostaId: p.id, aprovar: f.get("decisao") === "aprovar", motivo: String(f.get("motivo")) })));
      }}><fieldset disabled={ocupado} className="space-y-2"><label className="block">Decisão<select name="decisao" required defaultValue="" className={estilo}><option value="" disabled>Selecione</option><option value="aprovar" disabled={!!p.erroConferencia || !!p.conferencia?.pendencias.length}>Aprovar e publicar, incluindo a exceção indicada</option><option value="rejeitar">Rejeitar proposta</option></select></label>
        <label className="block">Justificativa da decisão<CampoTexto name="motivo" required minLength={5} maxLength={2000} className={estilo} /></label><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Confirmar decisão</button>
      </fieldset></form>}
    </article>)}
  </div>;
}
