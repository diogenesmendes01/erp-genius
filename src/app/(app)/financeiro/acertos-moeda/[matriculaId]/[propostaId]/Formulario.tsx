"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { proporMoedaAditivo, decidirMoedaAditivo, aplicarMoedaAditivo } from "@/server/contratos/moeda-aditivo";

type Props = { modo: "preparar" | "decidir" | "aplicar"; propostaId?: string; matriculaId?: string; versaoCondicoesId?: string; revisaoHash?: string };
/** A chave de idempotência é mantida entre repetições da mesma tentativa; erro de regra libera nova tentativa. */
export function MoedaFormulario(props: Props) {
 const router = useRouter();
 const [ocupado,setOcupado] = useState(false), [mensagem,setMensagem] = useState("");
 const [concluido,setConcluido] = useState(false), [preservada,setPreservada] = useState(false);
 const emEnvio = useRef(false);
 const tentativa = useRef<{ entrada: Record<string,unknown>; chave: string } | null>(null);
 return <form className="space-y-3 rounded border p-3" onSubmit={async evento => {
  evento.preventDefault(); if (ocupado || emEnvio.current || concluido) return;
  const form = new FormData(evento.currentTarget);
  if (!tentativa.current) tentativa.current = { chave: crypto.randomUUID(), entrada: props.modo === "preparar"
   ? { matriculaId: props.matriculaId, versaoCondicoesId: props.versaoCondicoesId, revisaoHash: props.revisaoHash, motivo: form.get("motivo"), evidencia: form.get("evidencia") }
   : props.modo === "decidir" ? { propostaId: props.propostaId, aprovada: form.get("decisao") === "aprovar", motivo: form.get("motivo") } : { propostaId: props.propostaId } };
  emEnvio.current = true; setOcupado(true); setPreservada(true); setMensagem("");
  try {
   const entrada = { ...tentativa.current.entrada, chaveIdempotencia: tentativa.current.chave };
   const r = await (props.modo === "preparar" ? proporMoedaAditivo(entrada) : props.modo === "decidir" ? decidirMoedaAditivo(entrada) : aplicarMoedaAditivo(entrada));
   if (r.ok) { setConcluido(true); setMensagem("Operação registrada."); router.refresh(); }
   else { tentativa.current = null; setPreservada(false); setMensagem(r.erro + " Confira o histórico antes de tentar novamente."); }
  } catch { setMensagem("Resultado não confirmado. Repita para consultar a mesma tentativa."); }
  finally { emEnvio.current = false; setOcupado(false); }
 }}>
 <fieldset disabled={ocupado || preservada} className="space-y-2">
 {props.modo !== "aplicar" && <label className="block">Motivo<textarea name="motivo" minLength={5} maxLength={2000} required className="block w-full rounded border p-2" /></label>}
 {props.modo === "preparar" && <label className="block">Evidência conferida<textarea name="evidencia" minLength={5} maxLength={4000} required className="block w-full rounded border p-2" /></label>}
 {props.modo === "decidir" && <label className="block">Decisão<select name="decisao" className="ml-2 rounded border p-2"><option value="aprovar">Aprovar</option><option value="rejeitar">Rejeitar</option></select></label>}
 </fieldset>
 <button disabled={ocupado || concluido} className="rounded border px-3 py-2" type="submit">{concluido ? "Registrado" : ocupado ? "Processando…" : preservada ? "Repetir mesma tentativa" : props.modo === "preparar" ? "Preparar acerto" : props.modo === "decidir" ? "Registrar decisão" : "Aplicar troca de moeda aprovada"}</button>
 {mensagem && <p role="status">{mensagem}</p>}
 </form>;
}
