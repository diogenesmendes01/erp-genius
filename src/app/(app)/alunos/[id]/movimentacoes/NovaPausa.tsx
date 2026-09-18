"use client";
import { useRef, useState } from "react";
import { useOperacao } from "./useOperacao";
import { Pendencias } from "./Pendencias";
import { preverPausaMatriculas } from "@/server/matricula/pausa-previa";
import { solicitarPausaMatriculas } from "@/server/matricula/pausa-proposta";
import { identificacaoContrato } from "./identificacaoContrato";

type Previa = NonNullable<Extract<Awaited<ReturnType<typeof preverPausaMatriculas>>, { ok: true }>["dado"]>;
export function NovaPausa({ alunoId, contratos, hoje }: { alunoId: string; contratos: { id: string; identificacao: string; produto: { nome: string } }[]; hoje: string | null }) {
  const [ids, setIds] = useState<string[]>([]);
  const [data, setData] = useState(hoje ?? "");
  const [motivo, setMotivo] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, iniciar] = useOperacao();
  const chave = useRef("");
  function alterar() { setPrevia(null); setErro(null); setAviso(null); chave.current = ""; }
  function conferir() {
    iniciar(async () => {
      setErro(null); setAviso(null); setPrevia(null);
      try {
        const r = await preverPausaMatriculas(alunoId, { matriculaIds: ids, dataEfetiva: data });
        if (!r.ok) { setErro(r.erro); return; }
        setPrevia(r.dado!);
      } catch { setErro("Não foi possível conferir os impactos. Tente novamente."); }
    });
  }
  function enviar() {
    if (!previa) return;
    iniciar(async () => {
      setErro(null); setAviso(null);
      chave.current ||= crypto.randomUUID();
      try {
        const r = await solicitarPausaMatriculas(alunoId, { matriculaIds: ids, dataEfetiva: data, motivo, chaveIdempotencia: chave.current });
        if (!r.ok) { setErro(r.erro); return; }
        setPrevia(null); setIds([]); setMotivo(""); chave.current = "";
        setAviso("Proposta registrada. Consulte as propostas abaixo para acompanhar a decisão de outra pessoa autorizada. A pausa ainda não foi aplicada.");
      } catch { setErro("Não foi possível confirmar o envio. Tente novamente sem alterar os dados para consultar o mesmo pedido."); }
    });
  }
  return <section className="space-y-4 rounded border p-4" aria-label="Solicitar pausa por contrato">
    <h2 className="text-lg font-medium">Nova proposta de pausa</h2>
    <p className="text-sm">Escolha somente os contratos que devem ser pausados. Os demais permanecem fora desta solicitação.</p>
    {!hoje && <p className="text-amber-700">O fuso institucional precisa ser configurado para conferir as datas da escola.</p>}
    {contratos.length === 0 ? <p>Nenhum contrato ativo disponível para seleção.</p> : <fieldset disabled={ocupado} className="space-y-3">
      <legend className="mb-2 font-medium">Contratos ativos</legend>
      {contratos.map((m) => <label key={m.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ids.includes(m.id)} onChange={(e) => { alterar(); setIds((atual) => e.target.checked ? [...atual, m.id] : atual.filter((id) => id !== m.id)); }} />{m.identificacao} · {m.produto.nome}</label>)}
      <label className="block text-sm">Data efetiva proposta<input type="date" className="ml-2 rounded border p-2" required value={data} onChange={(e) => { alterar(); setData(e.target.value); }} /></label>
      <label className="block text-sm">Motivo<textarea className="mt-1 block w-full rounded border p-2" rows={3} minLength={5} maxLength={2000} value={motivo} onChange={(e) => { alterar(); setMotivo(e.target.value); }} /></label>
      <button type="button" className="rounded border px-3 py-2 text-sm disabled:opacity-50" disabled={!ids.length || !data || motivo.trim().length < 5} onClick={conferir}>Conferir impactos</button>
    </fieldset>}
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
    {aviso && <p role="status" className="text-green-700">{aviso}</p>}
    {ocupado && <p role="status">Processando…</p>}
    {previa && <div className="space-y-3 border-t pt-3">
      <p className="text-sm">Referência: {previa.fusoInstitucional ?? "Fuso a conferir"}. A prévia não aplica alterações.</p>
      {previa.matriculas.map((m) => <div key={m.matriculaId} className="text-sm">
        <p className="font-medium">{identificacaoContrato(m.codigo, m.matriculaId)}</p>
        <p>{m.periodos.filter((p) => p.efeito === "SUSPENDER_PERIODO_FUTURO").length} período(s) futuro(s) a suspender; {m.periodos.filter((p) => p.efeito === "MANTER_PERIODO_INICIADO_INTEGRAL").length} período(s) iniciado(s) mantido(s) integralmente.</p>
        <Pendencias itens={m.pendencias} />
      </div>)}
      <button type="button" className="rounded bg-brand-600 px-3 py-2 text-sm text-white disabled:opacity-50" disabled={ocupado} onClick={enviar}>Registrar proposta para decisão independente</button>
    </div>}
  </section>;
}
