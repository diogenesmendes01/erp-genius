"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { decidirAcertoTaxaAditivo, aplicarAcertoTaxaAditivo, invalidarAcertoTaxaAditivo } from "@/server/contratos/aditivo-acerto-taxa-acoes";
export function DecisaoTaxa({ propostaId, podeDecidir, podeAplicar, podeInvalidar = false }: { propostaId: string; podeDecidir: boolean; podeAplicar: boolean; podeInvalidar?: boolean }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const enviando = useRef(false);
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  async function enviar(operacao: "aprovar" | "rejeitar" | "aplicar" | "invalidar") {
    if (enviando.current || (operacao === "aplicar" ? !podeAplicar : operacao === "invalidar" ? !podeInvalidar || motivo.trim().length < 5 : !podeDecidir || motivo.trim().length < 5)) return;
    const entrada = JSON.stringify({ propostaId, operacao, motivo: operacao === "aplicar" ? "" : motivo.trim() });
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    enviando.current = true; setOcupado(true); setMensagem("");
    try {
      const r = operacao === "aplicar"
        ? await aplicarAcertoTaxaAditivo({ propostaId, chaveIdempotencia: tentativa.current.chave })
        : operacao === "invalidar" ? await invalidarAcertoTaxaAditivo({ propostaId, motivo: motivo.trim(), evidencia: { conferencia: motivo.trim() }, chaveIdempotencia: tentativa.current.chave })
        : await decidirAcertoTaxaAditivo({ propostaId, aprovada: operacao === "aprovar", motivo: motivo.trim(), chaveIdempotencia: tentativa.current.chave });
      if (!r.ok) { setMensagem(r.erro); return; }
      setMensagem(operacao === "aplicar" ? "Acerto aplicado." : operacao === "invalidar" ? "Acerto invalidado; prepare uma nova proposta." : "Decisão registrada.");
      tentativa.current = null; router.refresh();
    } catch { setMensagem("Não foi possível confirmar o resultado. Tente novamente para conferir a mesma operação."); }
    finally { enviando.current = false; setOcupado(false); }
  }
  return <div className="space-y-2"><fieldset disabled={ocupado} className="space-y-2">
    {(podeDecidir || podeInvalidar) && <label className="block">{podeInvalidar ? "Motivo da invalidação" : "Motivo da decisão"}<textarea className="block w-full rounded border p-2" value={motivo} onChange={e => setMotivo(e.target.value)} minLength={5} maxLength={2000} /></label>}
    {podeDecidir && <><button type="button" disabled={motivo.trim().length < 5} onClick={() => enviar("aprovar")} className="rounded border px-3 py-2">Aprovar acerto</button>{" "}
      <button type="button" disabled={motivo.trim().length < 5} onClick={() => enviar("rejeitar")} className="rounded border px-3 py-2">Rejeitar acerto</button></>}
    {podeAplicar && <button type="button" onClick={() => enviar("aplicar")} className="rounded border px-3 py-2">Aplicar acerto aprovado</button>}
    {podeInvalidar && <button type="button" disabled={motivo.trim().length < 5} onClick={() => enviar("invalidar")} className="rounded border px-3 py-2">Conferir e invalidar para repropor</button>}
  </fieldset>{mensagem && <p role="status">{mensagem}</p>}</div>;
}
