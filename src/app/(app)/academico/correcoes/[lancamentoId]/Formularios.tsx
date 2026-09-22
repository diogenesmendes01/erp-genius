"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { proporCorrecaoNota, decidirCorrecaoNota } from "@/server/avaliacoes/correcao";
type Nota = { habilidade: "FALA" | "COMPREENSAO_ORAL" | "LEITURA" | "ESCRITA"; nota: string | null; comentarioAluno: string };
const nomes = { FALA: "Fala", COMPREENSAO_ORAL: "Compreensão oral", LEITURA: "Leitura", ESCRITA: "Escrita" };

export function ProporCorrecao({ lancamentoId, origemHash, versaoEsperada, notas }: { lancamentoId: string; origemHash: string; versaoEsperada: number; notas: Nota[] }) {
  const router = useRouter(), chave = useRef<string | null>(null);
  const [ocupado, setOcupado] = useState(false), [mensagem, setMensagem] = useState("");
  return <form className="space-y-3" onChange={() => { chave.current = null; setMensagem(""); }} onSubmit={async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget); chave.current ??= crypto.randomUUID(); setOcupado(true); setMensagem("");
    try {
      const r = await proporCorrecaoNota({ lancamentoId, origemHash, versaoEsperada, chaveIdempotencia: chave.current, motivo: String(f.get("motivo") ?? ""),
        notas: notas.map(n => ({ habilidade: n.habilidade, nota: String(f.get(`nota-${n.habilidade}`) ?? "").trim().replace(",", ".") || null, comentarioAluno: String(f.get(`comentario-${n.habilidade}`) ?? "") })) });
      if (!r.ok) setMensagem(r.erro); else { setMensagem("Proposta registrada. As notas permanecem vigentes até aprovação independente."); router.refresh(); }
    } catch { setMensagem("Resultado não confirmado. Tente novamente com os mesmos dados."); }
    finally { setOcupado(false); }
  }}><fieldset disabled={ocupado} className="space-y-3"><legend className="font-medium">Propor correção</legend>
    {notas.map(n => <div key={n.habilidade} className="space-y-2 rounded border p-3"><p>{nomes[n.habilidade]} — nota vigente: {n.nota}</p>
      <label className="block">Nova nota<input name={`nota-${n.habilidade}`} required maxLength={100} inputMode="decimal" defaultValue={n.nota ?? ""} className="block rounded border p-2" /></label>
      <label className="block">Comentário para o aluno<textarea name={`comentario-${n.habilidade}`} maxLength={2000} defaultValue={n.comentarioAluno} className="block w-full rounded border p-2" /></label>
    </div>)}
    <label className="block">Motivo da correção<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
    <label className="block"><input type="checkbox" required /> Conferi os valores vigentes e as alterações propostas.</label>
    <button className="rounded bg-brand-solid px-4 py-2 text-white">{ocupado ? "Registrando…" : "Registrar proposta"}</button>
  </fieldset>{mensagem && <p role="status">{mensagem}</p>}</form>;
}

export function DecidirCorrecao({ propostaId, propostaHash, impactosHash, podeAprovar }: { propostaId: string; propostaHash: string; impactosHash: string; podeAprovar: boolean }) {
  const router = useRouter(); const [ocupado, setOcupado] = useState(false), [mensagem, setMensagem] = useState("");
  return <form className="space-y-3" onSubmit={async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget); setOcupado(true); setMensagem("");
    try {
      const r = await decidirCorrecaoNota({ propostaId, propostaHash, impactosHash, aprovada: f.get("decisao") === "aprovar", motivo: String(f.get("motivo") ?? "") });
      if (!r.ok) setMensagem(r.erro); else { setMensagem(r.dado?.aplicada ? "Correção aprovada e aplicada." : "Proposta rejeitada."); router.refresh(); }
    } catch { setMensagem("Resultado não confirmado. Tente novamente com a mesma decisão."); }
    finally { setOcupado(false); }
  }}><fieldset disabled={ocupado} className="space-y-3"><legend className="font-medium">Decisão independente</legend>
    <label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2"><option value="">Selecione</option>{podeAprovar && <option value="aprovar">Aprovar e aplicar</option>}<option value="rejeitar">Rejeitar</option></select></label>
    <label className="block">Justificativa<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
    <label className="block"><input type="checkbox" required /> Conferi notas, comentários e impactos apresentados.</label>
    <button className="rounded border px-4 py-2">{ocupado ? "Registrando…" : "Registrar decisão"}</button>
  </fieldset>{mensagem && <p role="status">{mensagem}</p>}</form>;
}
