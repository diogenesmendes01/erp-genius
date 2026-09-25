"use client";
import { useRef, useState } from "react";
import { useOperacao } from "./useOperacao";
import { Pendencias } from "./Pendencias";
import { preverRetomadaMatriculas } from "@/server/matricula/retomada-previa";
import { solicitarRetomadaMatriculas } from "@/server/matricula/retomada-proposta";
import type { PreviaRetomadaMatriculasInput } from "@/server/matricula/retomada-schema";
import { identificacaoContrato } from "./identificacaoContrato";
import { MensagemStatus } from "@/components/MensagemStatus";
import { formatarDataCivil } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";
type Previa = NonNullable<Extract<Awaited<ReturnType<typeof preverRetomadaMatriculas>>, { ok: true }>["dado"]>;
type Opcao = "MANTER_VENCIMENTOS" | "REPROGRAMAR_PARCELAS";
const campo = "rounded border p-2 text-sm";
const data = (v: string) => v.split("-").reverse().join("/");

export function NovaRetomada({ alunoId, contratos, hoje }: { alunoId: string; contratos: { id: string; identificacao: string; nome: string }[]; hoje: string | null }) {
  const [ids, setIds] = useState<string[]>([]), [retorno, setRetorno] = useState(hoje ?? ""), [motivo, setMotivo] = useState("");
  const [base, setBase] = useState<Previa | null>(null), [previa, setPrevia] = useState<Previa | null>(null);
  const [opcoes, setOpcoes] = useState<Record<string, Opcao>>({}), [datas, setDatas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null), [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, iniciar] = useOperacao();
  const chave = useRef("");
  function alterar(recarregar = false) {
    setPrevia(null); setErro(null); setAviso(null); chave.current = "";
    if (recarregar) { setBase(null); setOpcoes({}); setDatas({}); }
  }
  function entrada(): PreviaRetomadaMatriculasInput {
    return { retorno, matriculas: ids.map((matriculaId) => ({ matriculaId, vencimentos: opcoes[matriculaId] === "REPROGRAMAR_PARCELAS"
      ? { opcao: "REPROGRAMAR_PARCELAS", datas: (base?.matriculas.find((m) => m.matriculaId === matriculaId)?.periodos ?? []).map((p) => ({ cobrancaId: p.cobrancaId, vencimento: datas[p.cobrancaId] ?? p.vencimentoAnterior })) }
      : { opcao: "MANTER_VENCIMENTOS" },
    })) };
  }
  function consultar(inicial: boolean) {
    iniciar(async () => {
      setErro(null); setPrevia(null); setAviso(null);
      try {
        const r = await preverRetomadaMatriculas(alunoId, inicial ? { retorno, matriculas: ids.map((matriculaId) => ({ matriculaId, vencimentos: { opcao: "MANTER_VENCIMENTOS" } })) } : entrada());
        if (!r.ok) { setErro(r.erro); return; }
        if (inicial) setBase(r.dado!); else setPrevia(r.dado!);
      } catch { setErro("Não foi possível conferir os períodos. Tente novamente."); }
    });
  }
  function enviar() {
    if (!previa) return;
    iniciar(async () => {
      setErro(null); chave.current ||= crypto.randomUUID();
      try {
        const r = await solicitarRetomadaMatriculas(alunoId, { ...entrada(), motivo, chaveIdempotencia: chave.current });
        if (!r.ok) { setErro(r.erro); return; }
        setBase(null); setPrevia(null); setIds([]); setMotivo(""); chave.current = "";
        setAviso("Proposta registrada para decisão independente. A retomada ainda não foi aplicada; consulte a lista abaixo.");
      } catch { setErro("Resultado do envio não confirmado. Repita sem alterar os dados para consultar o mesmo pedido."); }
    });
  }
  const escolhasCompletas = ids.length > 0 && ids.every((id) => !!opcoes[id]);
  return <section className="space-y-4 rounded border p-4" aria-label="Solicitar retomada por contrato">
    <h2 className="text-lg font-medium">Nova proposta de retomada</h2>
    {contratos.length === 0 ? <p>Nenhum contrato pausado disponível.</p> : <fieldset disabled={ocupado} className="space-y-3">
      <legend className="mb-2 font-medium">Contratos pausados</legend>
      {contratos.map((m) => <label key={m.id} className="flex gap-2 text-sm"><input type="checkbox" checked={ids.includes(m.id)} onChange={(e) => { alterar(true); setIds((v) => e.target.checked ? [...v, m.id] : v.filter((id) => id !== m.id)); }} />{m.identificacao} · {m.nome}</label>)}
      <label className="block text-sm">Data de retorno <input type="date" className={campo} value={retorno} onChange={(e) => { alterar(true); setRetorno(e.target.value); }} /></label>
      <label className="block text-sm">Motivo<textarea className={`${campo} mt-1 block w-full`} rows={3} maxLength={2000} value={motivo} onChange={(e) => { alterar(); setMotivo(e.target.value); }} /></label>
      <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={!ids.length || !retorno} onClick={() => consultar(true)}>Consultar períodos suspensos</button>
      {base?.matriculas.map((m) => <fieldset key={m.matriculaId} className="space-y-2 border-t pt-3">
        <legend className="font-medium">Contrato {identificacaoContrato(m.codigo, m.matriculaId)}</legend>
        <Pendencias itens={m.pendencias} />
        <label className="block text-sm">Tratamento dos vencimentos <select className={campo} value={opcoes[m.matriculaId] ?? ""} onChange={(e) => { alterar(); setOpcoes((v) => ({ ...v, [m.matriculaId]: e.target.value as Opcao })); }}><option value="">Selecione</option><option value="MANTER_VENCIMENTOS">Manter vencimentos originais</option><option value="REPROGRAMAR_PARCELAS">Reprogramar vencimentos</option></select></label>
        {opcoes[m.matriculaId] === "MANTER_VENCIMENTOS" && <p className="text-sm">Vencimentos antigos podem continuar em atraso. Retomar não quita a dívida.</p>}
        {m.periodos.map((p) => <label key={p.cobrancaId} className="block text-sm">Período original {data(p.coberturaAnterior.inicio)} a {data(p.coberturaAnterior.fim)} · vencimento {data(p.vencimentoAnterior)}
          {opcoes[m.matriculaId] === "REPROGRAMAR_PARCELAS" && <input aria-label={`Novo vencimento do período ${formatarDataCivil(p.coberturaAnterior.inicio)}`} type="date" className={`${campo} ml-2`} value={datas[p.cobrancaId] ?? p.vencimentoAnterior} onChange={(e) => { alterar(); setDatas((v) => ({ ...v, [p.cobrancaId]: e.target.value })); }} />}
        </label>)}
      </fieldset>)}
      {base && <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={!escolhasCompletas || motivo.trim().length < 5} onClick={() => consultar(false)}>Conferir proposta completa</button>}
    </fieldset>}
    {erro && <p role="alert" className="text-red-700">{erro}</p>}<MensagemStatus texto={aviso} className="text-green-700" progresso={ocupado ? "Processando…" : null} />
    {previa && <div className="space-y-3 border-t pt-3"><p>Fuso: {previa.fusoInstitucional ?? "A conferir"}. Cobertura e vencimentos serão aprovados juntos.</p>
      {previa.matriculas.map((m) => <div key={m.matriculaId}><h3 className="font-medium">Contrato {identificacaoContrato(m.codigo, m.matriculaId)}</h3>
        <Pendencias itens={m.pendencias} />
        {m.periodos.map((p) => <p key={p.cobrancaId} className="text-sm">Nova cobertura: {data(p.cobertura.inicio)} a {data(p.cobertura.fim)} · vencimento: {data(p.vencimentoAnterior)} → {data(p.vencimento)}</p>)}
      </div>)}
      <button type="button" disabled={ocupado} className={botaoClasses({ tamanho: "lg" })} onClick={enviar}>Registrar proposta para decisão independente</button>
    </div>}
  </section>;
}
