"use client";
import { useState, useTransition } from "react";
import { preverReplanejamentoCalendario } from "@/server/agenda/replanejamento-consulta";
import type { AjusteReplanejamento } from "@/server/agenda/replanejamento-ajustes";
import { ConteudoRevisao } from "./ConteudoRevisao";
import { SalvarRevisao } from "./SalvarRevisao";

type Revisao = NonNullable<Extract<Awaited<ReturnType<typeof preverReplanejamentoCalendario>>, { ok: true }>["dado"]>;
export function EditorRevisao({ inicial }: { inicial: Revisao }) {
  const [revisao, setRevisao] = useState(inicial);
  const [ajustes, setAjustes] = useState<AjusteReplanejamento[]>(inicial.ajustes);
  const [alterado, setAlterado] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const opcoes = revisao.revisoes.flatMap((t) => t.previsao?.propostas.map((p, i) => ({ id: p.encontroId, nome: `${t.codigo ?? "Turma sem código"} · Encontro ${i + 1} · ${t.fusoOrigem}` })) ?? []);
  function mudar(indice: number, valor: Partial<AjusteReplanejamento>) {
    setAjustes((a) => a.map((v, i) => i === indice ? { ...v, ...valor } : v)); setAlterado(true);
  }
  function conferir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    iniciar(async () => {
      setErro("");
      try {
        const r = await preverReplanejamentoCalendario({ calendarioId: inicial.calendarioId, ajustes });
        if (!r.ok || !r.dado) { setErro(r.ok ? "Conferência indisponível." : r.erro); return; }
        setRevisao(r.dado); setAjustes(r.dado.ajustes); setAlterado(false);
      } catch { setErro("Não foi possível conferir os ajustes. Tente novamente."); }
    });
  }
  const campo = "mt-1 block w-full rounded border bg-[var(--surface)] p-2";
  return <div className="space-y-5">
    <form onSubmit={conferir} className="space-y-3 rounded border p-4">
      <h2 className="font-medium">Ajustar datas sugeridas</h2>
      <p>Informe data e horário no fuso de origem indicado para a turma. A duração permanece a mesma. Dias não letivos exigem decisão explícita da exceção antes da aplicação.</p>
      <fieldset disabled={ocupado} className="space-y-3">
        {ajustes.map((a, i) => <fieldset key={i} className="grid gap-3 rounded border p-3 sm:grid-cols-2">
          <legend>Ajuste {i + 1}</legend>
          <label>Encontro<select required value={a.encontroId} onChange={(e) => mudar(i, { encontroId: e.target.value })} className={campo}>
            <option value="">Escolha o encontro</option>{opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select></label>
          <label>Data no fuso da turma<input required type="date" value={a.data} onChange={(e) => mudar(i, { data: e.target.value })} className={campo} /></label>
          <label>Horário no fuso da turma<input required type="time" value={a.horario} onChange={(e) => mudar(i, { horario: e.target.value })} className={campo} /></label>
          <label>Motivo do ajuste<textarea required minLength={5} maxLength={2000} value={a.motivo} onChange={(e) => mudar(i, { motivo: e.target.value })} className={campo} /></label>
          <button type="button" className="justify-self-start rounded border px-3 py-2" onClick={() => { setAjustes((v) => v.filter((_, j) => i !== j)); setAlterado(true); }}>Remover ajuste {i + 1}</button>
        </fieldset>)}
        <div className="flex gap-3">
          <button type="button" disabled={ajustes.length >= opcoes.length} className="rounded border px-3 py-2" onClick={() => { setAjustes((v) => [...v, { encontroId: "", data: "", horario: "", motivo: "" }]); setAlterado(true); }}>Adicionar ajuste</button>
          <button className="rounded bg-brand-700 px-3 py-2 text-white">{ocupado ? "Conferindo…" : "Conferir datas e conflitos"}</button>
        </div>
      </fieldset>
      {erro && <p role="alert">{erro}</p>}
    </form>
    {alterado && <p role="status">Há ajustes ainda não conferidos. O resultado abaixo corresponde à última conferência; confira novamente para guardar a revisão.</p>}
    <ConteudoRevisao r={revisao} />
    {!alterado && !ocupado && <SalvarRevisao key={`${revisao.estadoHash}:${revisao.versaoRascunho}`} calendarioId={revisao.calendarioId} estadoHash={revisao.estadoHash} versaoAnterior={revisao.versaoRascunho} ajustes={revisao.ajustes.length ? revisao.ajustes : undefined} />}
  </div>;
}
