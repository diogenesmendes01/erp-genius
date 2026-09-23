"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HABILIDADES } from "@/server/avaliacoes/calculo";
import { proporPlanoRecuperacao } from "@/server/avaliacoes/recuperacao-proposta";
import { decidirPlanoRecuperacao } from "@/server/avaliacoes/recuperacao-decisao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
type Habilidade = typeof HABILIDADES[number];
const nomes = { FALA: "Fala", COMPREENSAO_ORAL: "Compreensão oral", LEITURA: "Leitura", ESCRITA: "Escrita" };

export function PrepararPlano({ alocacaoId, versaoEsperada, obrigatorias, selecionaveis, autorizacaoPreparacaoId }: { alocacaoId: string; versaoEsperada: number; obrigatorias: Habilidade[]; selecionaveis: Habilidade[]; autorizacaoPreparacaoId?: string }) {
  const [selecionadas, setSelecionadas] = useState<Habilidade[]>(obrigatorias);
  const [erro, setErro] = useState(""), [enviando, setEnviando] = useState(false);
  const chave = useRef<string | null>(null), router = useRouter();
  return <form className="space-y-4 rounded border p-4" onChange={() => { chave.current = null; }} onSubmit={async e => {
    e.preventDefault(); if (enviando) return;
    const data = new FormData(e.currentTarget); chave.current ??= crypto.randomUUID(); setEnviando(true); setErro("");
    try {
      const r = await proporPlanoRecuperacao({ alocacaoId, versaoEsperada, chaveIdempotencia: chave.current, motivo: String(data.get("motivo") ?? ""), autorizacaoPreparacaoId,
        atividades: selecionadas.map(habilidade => ({ habilidade, estrategia: String(data.get(`estrategia-${habilidade}`) ?? ""), avaliacaoProposta: String(data.get(`avaliacao-${habilidade}`) ?? "") })) });
      if (!r.ok) setErro(r.erro); else { chave.current = null; router.refresh(); }
    } catch { setErro("Resultado não confirmado. Reenvie sem alterar os dados para conferir a mesma proposta."); }
    finally { setEnviando(false); }
  }}>
    <h2 className="text-xl font-medium">Preparar plano de recuperação</h2>
    <p>Inclua todas as habilidades abaixo do mínimo. Se faltar apenas a média geral, escolha as habilidades a trabalhar. A proposta precisa de aprovação independente.</p>
    <fieldset disabled={enviando} className="space-y-4">
      {selecionaveis.map(h => <div key={h} className="space-y-2 rounded border p-3">
        <label><input type="checkbox" checked={selecionadas.includes(h)} disabled={obrigatorias.includes(h)} onChange={e => setSelecionadas(s => e.target.checked ? [...s, h] : s.filter(v => v !== h))} /> {nomes[h]}{obrigatorias.includes(h) ? " (obrigatória)" : ""}</label>
        {selecionadas.includes(h) && <>
          <label className="block">Estratégia pedagógica<textarea name={`estrategia-${h}`} required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
          <label className="block">Avaliação proposta<textarea name={`avaliacao-${h}`} required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
        </>}
      </div>)}
      <label className="block">Justificativa do plano<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <button type="submit" disabled={!selecionadas.length} className="rounded border px-4 py-2">{enviando ? "Enviando…" : "Propor plano"}</button>
    </fieldset>{erro && <p role="alert">{erro}</p>}
  </form>;
}

export function DecidirPlano({ propostaId, propostaHash, podeAprovar }: { propostaId: string; propostaHash: string; podeAprovar: boolean }) {
  const [erro, setErro] = useState(""), [enviando, setEnviando] = useState(false), router = useRouter();
  return <form className="space-y-2" onSubmit={async e => {
    e.preventDefault(); if (enviando) return;
    const data = new FormData(e.currentTarget); setEnviando(true); setErro("");
    try {
      const r = await decidirPlanoRecuperacao({ propostaId, propostaHash, aprovada: data.get("decisao") === "aprovar", motivo: String(data.get("motivo") ?? "") });
      if (!r.ok) setErro(r.erro); else router.refresh();
    } catch { setErro(MSG_DECISAO_INCERTA); }
    finally { setEnviando(false); }
  }}>
    <fieldset disabled={enviando} className="space-y-2">
      <label className="block">Decisão<select name="decisao" required defaultValue="" className="ml-2 rounded border p-2"><option value="" disabled>Selecione</option>{podeAprovar && <option value="aprovar">Aprovar plano</option>}<option value="rejeitar">Rejeitar plano</option></select></label>
      <label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <button type="submit" className="rounded border px-4 py-2">{enviando ? "Registrando…" : "Registrar decisão"}</button>
    </fieldset>{erro && <p role="alert">{erro}</p>}
  </form>;
}
