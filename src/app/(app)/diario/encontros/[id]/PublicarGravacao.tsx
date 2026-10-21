"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { registrarGravacaoAula } from "@/server/diario/gravacao-aula";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";

export function PublicarGravacao({ encontroId }: { encontroId: string }) {
  const [arquivoOficialId, setArquivoOficialId] = useState("");
  const [erro, setErro] = useState("");
  const [publicada, setPublicada] = useState(false);
  const [ocupado, iniciar] = useTransition();
  const chaves = useRef(new Map<string, string>());

  function publicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const arquivoId = arquivoOficialId.trim();
    if (!/^[A-Za-z0-9_-]{3,500}$/.test(arquivoId)) return;
    const chaveIdempotencia = chaves.current.get(arquivoId) ?? crypto.randomUUID();
    chaves.current.set(arquivoId, chaveIdempotencia);
    iniciar(async () => {
      setErro("");
      try {
        const resultado = await registrarGravacaoAula({ encontroId, arquivoOficialId: arquivoId, chaveIdempotencia });
        if (!resultado.ok) {
          setErro(resultado.erro);
          return;
        }
        setPublicada(true);
      } catch {
        setErro(MSG_RESULTADO_INCERTO);
      }
    });
  }

  return <section className="space-y-3 rounded border p-4">
    <h2 className="font-medium">Publicar gravação da aula</h2>
    {publicada ? <p role="status">Aula concluída com a revisão institucional do vídeo registrada. Alteração externa do arquivo não substitui este vídeo aprovado. Consulte o <Link href="/diario" className="text-brand-700 underline">diário</Link>.</p> : <form className="space-y-3" onSubmit={publicar}>
      <label className="block text-sm">Identificador do arquivo no Drive
        <input value={arquivoOficialId} onChange={(evento) => setArquivoOficialId(evento.target.value)} disabled={ocupado} required minLength={3} maxLength={500} pattern="[A-Za-z0-9_-]+" className="mt-1 block w-full rounded border p-2" />
      </label>
      <p className="text-sm text-gray-600">Em um link como drive.google.com/file/d/1AbC_dEfG-23/view, informe somente <code>1AbC_dEfG-23</code>.</p>
      <button type="submit" disabled={ocupado} className={botaoClasses({ tamanho: "lg" })}>{ocupado ? "Publicando…" : "Publicar gravação e concluir aula"}</button>
    </form>}
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
  </section>;
}
