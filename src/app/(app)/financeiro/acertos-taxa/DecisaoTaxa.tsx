"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { decidirAcertoTaxaAditivo, aplicarAcertoTaxaAditivo, invalidarAcertoTaxaAditivo } from "@/server/contratos/aditivo-acerto-taxa-acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
export function DecisaoTaxa({ propostaId, podeDecidir, podeAplicar, podeInvalidar = false }: { propostaId: string; podeDecidir: boolean; podeAplicar: boolean; podeInvalidar?: boolean }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  // As três actions recebem chave de idempotência estável: na falha de transporte, reenviar a mesma operação confere o resultado.
  const acao = useAcaoCliente({ idempotente: true });
  const enviando = useRef(false);
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  async function enviar(operacao: "aprovar" | "rejeitar" | "aplicar" | "invalidar") {
    if (enviando.current || (operacao === "aplicar" ? !podeAplicar : operacao === "invalidar" ? !podeInvalidar || motivo.trim().length < 5 : !podeDecidir || motivo.trim().length < 5)) return;
    const entrada = JSON.stringify({ propostaId, operacao, motivo: operacao === "aplicar" ? "" : motivo.trim() });
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    const chave = tentativa.current.chave;
    enviando.current = true;
    try {
      const d = await acao.executar<unknown>(() => operacao === "aplicar"
        ? aplicarAcertoTaxaAditivo({ propostaId, chaveIdempotencia: chave })
        : operacao === "invalidar" ? invalidarAcertoTaxaAditivo({ propostaId, motivo: motivo.trim(), evidencia: { conferencia: motivo.trim() }, chaveIdempotencia: chave })
        : decidirAcertoTaxaAditivo({ propostaId, aprovada: operacao === "aprovar", motivo: motivo.trim(), chaveIdempotencia: chave }),
      operacao === "aplicar" ? "Acerto aplicado." : operacao === "invalidar" ? "Acerto invalidado; prepare uma nova proposta." : "Decisão registrada.");
      if (d?.tipo === "ok") { tentativa.current = null; router.refresh(); }
    } finally { enviando.current = false; }
  }
  return <div className="space-y-2"><fieldset disabled={acao.ocupado} className="space-y-2">
    {(podeDecidir || podeInvalidar) && <label className="block">{podeInvalidar ? "Motivo da invalidação" : "Motivo da decisão"}<CampoTexto className="block w-full rounded border p-2" value={motivo} onChange={e => setMotivo(e.target.value)} minLength={5} maxLength={2000} /></label>}
    {podeDecidir && <><button type="button" disabled={motivo.trim().length < 5} onClick={() => enviar("aprovar")} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Aprovar acerto</button>{" "}
      <button type="button" disabled={motivo.trim().length < 5} onClick={() => enviar("rejeitar")} className={botaoClasses({ variante: "perigo", tamanho: "lg" })}>Rejeitar acerto</button></>}
    {podeAplicar && <button type="button" onClick={() => enviar("aplicar")} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Aplicar acerto aprovado</button>}
    {podeInvalidar && <button type="button" disabled={motivo.trim().length < 5} onClick={() => enviar("invalidar")} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Conferir e invalidar para repropor</button>}
  </fieldset><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /></div>;
}
