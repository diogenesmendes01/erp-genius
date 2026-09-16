"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { consultarCancelamentoParticular, proporCancelamentoParticular, decidirCancelamentoParticular } from "@/server/agenda/cancelamento-particular";

type Resposta = Awaited<ReturnType<typeof consultarCancelamentoParticular>>;
type Dados = Extract<Resposta, { ok: true }>["dado"];
export function CancelamentoParticular({ encontroId, dados }: { encontroId: string; dados: NonNullable<Dados> }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const chave = useRef<string | null>(null);
  const router = useRouter();
  return <div className="space-y-4">
    <p>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: dados.fuso }).format(new Date(dados.inicio))} · {dados.fuso} · {dados.status}</p>
    {erro && <p role="alert">{erro}</p>}
    {dados.podePropor && <form className="space-y-2" onSubmit={e => {
      e.preventDefault(); const form = new FormData(e.currentTarget), motivo = String(form.get("motivo") ?? ""), origem = String(form.get("origem")) as "ESCOLA" | "ALUNO";
      chave.current ??= crypto.randomUUID(); const chaveIdempotencia = chave.current;
      iniciar(async () => { const r = await proporCancelamentoParticular({ encontroId, motivo, origem, chaveIdempotencia });
        setErro(r.ok ? "" : r.erro); if (r.ok) { chave.current = null; router.refresh(); } });
    }}>
      <label className="block">Motivo do cancelamento<textarea name="motivo" className="block w-full border p-2" required minLength={5} maxLength={2000} onChange={() => { chave.current = null; }} /></label>
      <label className="block">Quem cancelou?<select name="origem" required defaultValue="" className="block border p-2" onChange={() => { chave.current = null; }}><option value="" disabled>Selecione</option><option value="ESCOLA">Escola</option><option value="ALUNO">Aluno</option></select></label>
      <button disabled={pendente} className="rounded border p-2">Solicitar cancelamento</button>
    </form>}
    {dados.propostas.map(p => <article key={p.id} className="space-y-2 rounded border p-4">
      <p>Origem: {p.origem === "ALUNO" ? "aluno" : "escola"}.</p><p>{p.motivo}</p><p>{p.decisao ? p.decisao.aprovada ? "Cancelamento aprovado" : "Solicitação rejeitada" : "Aguardando decisão de outra pessoa"}</p>
      {p.decisao && <p>Decisão: {p.decisao.motivo}</p>}
      {p.podeDecidir && <form className="space-y-2" onSubmit={e => {
        e.preventDefault(); const form = new FormData(e.currentTarget);
        const motivo = String(form.get("motivo") ?? ""), aprovar = form.get("decisao") === "aprovar";
        iniciar(async () => { const r = await decidirCancelamentoParticular({ propostaId: p.id, motivo, aprovar });
          setErro(r.ok ? "" : r.erro); if (r.ok) router.refresh(); });
      }}>
        <label className="block">Decisão<select name="decisao" required defaultValue="" className="block border p-2"><option value="" disabled>Selecione</option><option value="aprovar">Aprovar cancelamento</option><option value="rejeitar">Rejeitar solicitação</option></select></label>
        <label className="block">Justificativa da decisão<textarea name="motivo" className="block w-full border p-2" required minLength={5} maxLength={2000} /></label>
        <button disabled={pendente} className="rounded border p-2">Confirmar decisão</button>
      </form>}
    </article>)}
  </div>;
}
