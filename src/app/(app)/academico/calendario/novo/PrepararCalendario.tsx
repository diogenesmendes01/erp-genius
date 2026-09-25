"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepararCalendarioEscolar } from "@/server/agenda/calendario";
import { botaoClasses } from "@/components/Botao";

type Periodo = { id: string; nome: string; tipo: "FERIADO" | "RECESSO" | "FERIAS"; inicio: string; fim: string };
export function PrepararCalendario({ periodosIniciais, versaoAnterior, fusoConferido }: { periodosIniciais: Periodo[]; versaoAnterior: number; fusoConferido: string }) {
  const router = useRouter();
  const [periodos, setPeriodos] = useState(periodosIniciais);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const tentativa = useRef<{ assinatura: string; chave: string } | null>(null);
  function alterar(id: string, valores: Partial<Periodo>) { setPeriodos((anteriores) => anteriores.map((p) => p.id === id ? { ...p, ...valores } : p)); }
  function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dados = { periodos, motivo, versaoAnterior, fusoConferido }, assinatura = JSON.stringify(dados);
    if (tentativa.current?.assinatura !== assinatura) tentativa.current = { assinatura, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current.chave;
    iniciar(async () => {
      setErro("");
      try {
        const r = await prepararCalendarioEscolar({ ...dados, chaveIdempotencia });
        if (!r.ok || !r.dado) { setErro(r.ok ? "Proposta não confirmada." : r.erro); return; }
        router.push(`/academico/calendario/${r.dado.id}`);
      } catch { setErro("Não foi possível confirmar o envio. Reenvie os mesmos dados para conferir o resultado."); }
    });
  }
  const campo = "mt-1 block w-full rounded border bg-[var(--surface)] p-2";
  return <form onSubmit={enviar} className="space-y-4">
    <fieldset disabled={ocupado} className="space-y-4">
      <legend className="font-medium">Períodos não letivos da proposta</legend>
      {!periodos.length && <p>A proposta não contém períodos não letivos.</p>}
      {periodos.map((p, indice) => <fieldset key={p.id} className="grid gap-3 rounded border p-4 sm:grid-cols-2">
        <legend>Período {indice + 1}</legend>
        <label>Nome<input required minLength={2} maxLength={200} value={p.nome} onChange={(e) => alterar(p.id, { nome: e.target.value })} className={campo} /></label>
        <label>Tipo<select value={p.tipo} onChange={(e) => alterar(p.id, { tipo: e.target.value as Periodo["tipo"] })} className={campo}><option value="FERIADO">Feriado</option><option value="RECESSO">Recesso</option><option value="FERIAS">Férias</option></select></label>
        <label>Data inicial<input required type="date" value={p.inicio} onChange={(e) => alterar(p.id, { inicio: e.target.value })} className={campo} /></label>
        <label>Data final<input required type="date" min={p.inicio || undefined} value={p.fim} onChange={(e) => alterar(p.id, { fim: e.target.value })} className={campo} /></label>
        <button type="button" onClick={() => setPeriodos((anteriores) => anteriores.filter((a) => a.id !== p.id))} className={`${botaoClasses({ variante: "secundario", tamanho: "lg" })} justify-self-start`} aria-label={`Remover período ${indice + 1}: ${p.nome || "sem nome"}`}>Remover da proposta</button>
      </fieldset>)}
      <button type="button" disabled={periodos.length >= 10000} onClick={() => setPeriodos((anteriores) => [...anteriores, { id: crypto.randomUUID(), nome: "", tipo: "FERIADO", inicio: "", fim: "" }])} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Adicionar período</button>
      <p className="text-sm">As datas inicial e final estão incluídas. Remover um período altera apenas esta proposta; versões anteriores permanecem preservadas.</p>
      <label className="block">Motivo da nova versão<textarea required minLength={5} maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={campo} /></label>
      <button disabled={motivo.trim().length < 5} className={botaoClasses({ tamanho: "lg" })}>{ocupado ? "Preparando…" : "Preparar calendário para revisão"}</button>
    </fieldset>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
  </form>;
}
