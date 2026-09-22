"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarLancamentoAvaliacaoLocal, oficializarLancamentoAvaliacao } from "@/server/avaliacoes/lancamentos";

type Habilidade = "FALA" | "COMPREENSAO_ORAL" | "LEITURA" | "ESCRITA";
export const nomes: Record<Habilidade, string> = { FALA: "Fala", COMPREENSAO_ORAL: "Compreensão oral", LEITURA: "Leitura", ESCRITA: "Escrita" };
type Nota = { habilidade: Habilidade; nota: string | null; comentarioAluno: string };

export function LancarNotas({ alocacaoId, codigoAvaliacao, versaoEsperada, habilidades, escala, anterior, fuso, realizadores, registradorId }: {
  alocacaoId: string; codigoAvaliacao: string; versaoEsperada: number; habilidades: Habilidade[];
  escala: { minimo: string; maximo: string }; anterior: { realizadaEm: string; notas: Nota[] } | null; fuso: string;
  realizadores: { id: string; nome: string }[]; registradorId: string;
}) {
  const router = useRouter(), chave = useRef<string | null>(null);
  const [ocupado, setOcupado] = useState(false), [mensagem, setMensagem] = useState("");
  const [realizador, setRealizador] = useState("");
  return <form className="space-y-3" onChange={() => { chave.current = null; setMensagem(""); }} onSubmit={async e => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    const realizada = String(form.get("realizadaEm") ?? "");
    if (!realizada) return;
    chave.current ??= crypto.randomUUID(); setOcupado(true); setMensagem("");
    try {
      const r = await salvarLancamentoAvaliacaoLocal({ alocacaoId, codigoAvaliacao, versaoEsperada, chaveIdempotencia: chave.current,
        realizadaLocal: realizada, fuso, submetida: form.get("modo") === "submeter",
        ...(realizador ? { realizadaPorId: realizador } : {}),
        ...(realizador && realizador !== registradorId ? { motivoRegularizacao: String(form.get("motivoRegularizacao") ?? ""), evidenciasRegularizacao: String(form.get("evidenciasRegularizacao") ?? "") } : {}),
        notas: habilidades.map(habilidade => ({ habilidade, nota: String(form.get(`nota-${habilidade}`) ?? "").trim().replace(",", ".") || null, comentarioAluno: String(form.get(`comentario-${habilidade}`) ?? "") })),
      });
      if (!r.ok) setMensagem(r.erro); else { setMensagem("Versão registrada. A submissão exige conferência de outra pessoa da gestão."); router.refresh(); }
    } catch { setMensagem("Resultado não confirmado. Confira a data e tente novamente com os mesmos dados."); }
    finally { setOcupado(false); }
  }}>
    <fieldset disabled={ocupado} className="space-y-4"><legend className="font-medium">Registrar avaliação realizada</legend>
      <label className="block">Data e horário da realização ({fuso})<input type="datetime-local" name="realizadaEm" step="0.001" required defaultValue={anterior?.realizadaEm} className="block rounded border p-2" /></label>
      {!!realizadores.length && <label className="block">Quem realizou a avaliação?<select required value={realizador} onChange={e => setRealizador(e.target.value)} className="block rounded border p-2"><option value="">Selecione o professor</option>{realizadores.map(p => <option key={p.id} value={p.id}>{p.nome}{p.id === registradorId ? " (eu)" : ""}</option>)}</select></label>}
      {realizador && realizador !== registradorId && <>
        <label className="block">Motivo da regularização<textarea name="motivoRegularizacao" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
        <label className="block">Evidências utilizadas<textarea name="evidenciasRegularizacao" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
        <p>Identifique os registros utilizados para conferir a avaliação e as notas. Seu nome ficará registrado como responsável pelo lançamento.</p>
      </>}
      <p>Escala: {escala.minimo} a {escala.maximo}. Campo de nota vazio permanece pendente no rascunho.</p>
      {habilidades.map(h => { const n = anterior?.notas.find(n => n.habilidade === h); return <div key={h} className="space-y-2 rounded border p-3">
        <label className="block">Nota de {nomes[h]}<input name={`nota-${h}`} inputMode="decimal" maxLength={100} defaultValue={n?.nota ?? ""} className="block rounded border p-2" /></label>
        <label className="block">Comentário para o aluno — {nomes[h]}<textarea name={`comentario-${h}`} maxLength={2000} defaultValue={n?.comentarioAluno ?? ""} className="block w-full rounded border p-2" /></label>
      </div>; })}
      <label className="block">Encaminhamento<select name="modo" required defaultValue="" className="block rounded border p-2"><option value="">Selecione</option><option value="rascunho">Salvar rascunho</option><option value="submeter">Submeter para conferência</option></select></label>
      <button className="rounded bg-brand-solid px-4 py-2 text-white">{ocupado ? "Registrando…" : "Registrar versão"}</button>
    </fieldset>{mensagem && <p role="status">{mensagem}</p>}
  </form>;
}

export function ConferirNotas({ lancamentoId, conteudoHash, podeAprovar }: { lancamentoId: string; conteudoHash: string; podeAprovar: boolean }) {
  const router = useRouter(); const [ocupado, setOcupado] = useState(false), [mensagem, setMensagem] = useState("");
  return <form className="space-y-3" onSubmit={async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget); setOcupado(true); setMensagem("");
    try {
      const r = await oficializarLancamentoAvaliacao({ lancamentoId, conteudoHash, aprovada: f.get("decisao") === "aprovar", motivo: String(f.get("motivo") ?? "") });
      if (!r.ok) setMensagem(r.erro); else { setMensagem("Decisão registrada."); router.refresh(); }
    } catch { setMensagem("Resultado não confirmado. Tente novamente com a mesma decisão."); }
    finally { setOcupado(false); }
  }}>
    <fieldset disabled={ocupado} className="space-y-3"><legend className="font-medium">Conferência independente</legend>
      <label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2"><option value="">Selecione</option>{podeAprovar && <option value="aprovar">Oficializar notas desta versão</option>}<option value="devolver">Devolver para revisão</option></select></label>
      <label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <label className="block"><input type="checkbox" required /> Conferi data, habilidades, notas e comentários desta versão.</label>
      <button className="rounded border px-4 py-2">{ocupado ? "Registrando…" : "Registrar decisão"}</button>
    </fieldset>{mensagem && <p role="status">{mensagem}</p>}
  </form>;
}
