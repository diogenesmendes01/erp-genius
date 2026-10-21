"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { solicitarConclusaoSemGravacao } from "@/server/diario/excecao-gravacao";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";

export function SolicitarExcecao({ encontroId }: { encontroId: string }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [ocupado, iniciar] = useTransition();
  const tentativa = useRef<{ motivo: string; chave: string } | null>(null);
  return <section className="space-y-3 rounded border p-4">
    <h2 className="font-medium">Gravação irrecuperável</h2>
    <p className="text-sm">Se não houver gravação recuperável, salve a chamada completa e explique o ocorrido para análise da gestão.</p>
    {enviado ? <p role="status">Solicitação enviada. Acompanhe em <Link href="/diario/excecoes-gravacao" className="text-brand-700 underline">exceções de gravação</Link>.</p> : <>
      <label className="block text-sm">Justificativa da ausência de gravação<CampoTexto value={motivo} disabled={ocupado} onChange={(e) => setMotivo(e.target.value)} maxLength={2000} className="mt-1 block w-full rounded border p-2" /></label>
      <button disabled={ocupado || motivo.trim().length < 5} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={() => {
        if (tentativa.current?.motivo !== motivo) tentativa.current = { motivo, chave: crypto.randomUUID() };
        const chaveIdempotencia = tentativa.current.chave;
        iniciar(async () => {
          setErro("");
          try {
            const r = await solicitarConclusaoSemGravacao({ encontroId, motivo, chaveIdempotencia });
            if (!r.ok) { setErro(r.erro); return; }
            setEnviado(true);
          } catch { setErro(MSG_RESULTADO_INCERTO); }
        });
      }}>Solicitar conclusão excepcional</button>
    </>}
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
  </section>;
}
