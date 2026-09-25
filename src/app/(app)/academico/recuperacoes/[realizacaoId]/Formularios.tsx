"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarNotaRecuperacao, decidirNotaRecuperacao } from "@/server/avaliacoes/recuperacao-nota";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { botaoClasses } from "@/components/Botao";

export function LancarNota({ realizacaoId, versaoEsperada, nota, comentarioAluno }: { realizacaoId: string; versaoEsperada: number; nota: string | null; comentarioAluno: string }) {
  const [erro, setErro] = useState(""), [enviando, setEnviando] = useState(false);
  const chave = useRef<string | null>(null), router = useRouter();
  return <form className="space-y-3 rounded border p-4" onChange={() => { chave.current = null; }} onSubmit={async e => {
    e.preventDefault(); if (enviando) return;
    const data = new FormData(e.currentTarget), submetida = data.get("submetida") === "on";
    chave.current ??= crypto.randomUUID(); setEnviando(true); setErro("");
    try {
      const r = await salvarNotaRecuperacao({ realizacaoId, versaoEsperada, nota: String(data.get("nota") ?? "").trim() || null, comentarioAluno: String(data.get("comentario") ?? ""), submetida, chaveIdempotencia: chave.current });
      if (!r.ok) setErro(r.erro); else { chave.current = null; router.refresh(); }
    } catch { setErro("Não foi possível confirmar o resultado. Tente novamente sem alterar os dados."); }
    finally { setEnviando(false); }
  }}>
    <h2 className="text-xl font-medium">Lançar nota</h2>
    <fieldset disabled={enviando} className="space-y-3">
      <label className="block">Nota (use ponto para decimais)<input name="nota" defaultValue={nota ?? ""} inputMode="decimal" maxLength={100} pattern="-?[0-9]+(\.[0-9]+)?" className="block rounded border p-2" /></label>
      <label className="block">Comentário destinado ao aluno<textarea name="comentario" defaultValue={comentarioAluno} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <label className="block"><input type="checkbox" name="submetida" /> Submeter para conferência independente</label>
      <button type="submit" className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{enviando ? "Salvando…" : "Salvar versão"}</button>
    </fieldset>
    {erro && <p role="alert">{erro}</p>}
  </form>;
}

export function ConferirNota({ notaId, entradaHash, podeAprovar }: { notaId: string; entradaHash: string; podeAprovar: boolean }) {
  const [erro, setErro] = useState(""), [enviando, setEnviando] = useState(false), router = useRouter();
  return <form className="space-y-2" onSubmit={async e => {
    e.preventDefault(); if (enviando) return;
    const data = new FormData(e.currentTarget); setEnviando(true); setErro("");
    try {
      const r = await decidirNotaRecuperacao({ notaId, entradaHash, aprovada: data.get("decisao") === "aprovar", motivo: String(data.get("motivo") ?? "") });
      if (!r.ok) setErro(r.erro); else router.refresh();
    } catch { setErro(MSG_DECISAO_INCERTA); }
    finally { setEnviando(false); }
  }}>
    <fieldset disabled={enviando} className="space-y-2">
      <label className="block">Decisão<select name="decisao" required defaultValue="" className="ml-2 rounded border p-2"><option value="" disabled>Selecione</option>{podeAprovar && <option value="aprovar">Oficializar esta versão</option>}<option value="rejeitar">Rejeitar esta versão</option></select></label>
      <label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} type="submit">{enviando ? "Conferindo…" : "Registrar decisão"}</button>
    </fieldset>{erro && <p role="alert">{erro}</p>}
  </form>;
}
