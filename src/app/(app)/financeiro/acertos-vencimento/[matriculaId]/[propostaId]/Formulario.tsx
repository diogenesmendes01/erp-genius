"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { proporVencimentoAditivo, decidirVencimentoAditivo, aplicarVencimentoAditivo } from "@/server/contratos/vencimento-aditivo";

type Props = { modo: "preparar" | "decidir" | "aplicar"; propostaId?: string; matriculaId?: string; versaoCondicoesId?: string; revisaoHash?: string };
export function VencimentoFormulario(props: Props) {
 const router = useRouter();
 const [ocupado,setOcupado] = useState(false), [mensagem,setMensagem] = useState("");
 const tentativa = useRef<{ entrada: Record<string,unknown>; chave: string } | null>(null);
 return <form className="space-y-3 rounded border p-3" onSubmit={async evento => {
  evento.preventDefault(); if (ocupado) return;
  const form = new FormData(evento.currentTarget);
  if (!tentativa.current) tentativa.current = { chave: crypto.randomUUID(), entrada: props.modo === "preparar"
   ? { matriculaId: props.matriculaId, versaoCondicoesId: props.versaoCondicoesId, revisaoHash: props.revisaoHash, motivo: form.get("motivo"), evidencia: form.get("evidencia") }
   : props.modo === "decidir" ? { propostaId: props.propostaId, aprovada: form.get("decisao") === "aprovar", motivo: form.get("motivo") } : { propostaId: props.propostaId } };
  setOcupado(true); setMensagem("");
  try {
   const entrada = { ...tentativa.current.entrada, chaveIdempotencia: tentativa.current.chave };
   const r = await (props.modo === "preparar" ? proporVencimentoAditivo(entrada) : props.modo === "decidir" ? decidirVencimentoAditivo(entrada) : aplicarVencimentoAditivo(entrada));
   if (r.ok) { setMensagem("Operação registrada."); tentativa.current = null; router.refresh(); }
   else if (r.podeRevisar) { tentativa.current = null; setMensagem(r.erro + " Corrija os dados antes de tentar novamente."); }
   else setMensagem(r.erro + " A tentativa foi preservada; confira o histórico antes de iniciar outra operação.");
  } catch { setMensagem("Resultado não confirmado. Repita para consultar a mesma tentativa."); }
  finally { setOcupado(false); }
 }}>
 <fieldset disabled={ocupado || !!tentativa.current} className="space-y-2">
 {props.modo !== "aplicar" && <label className="block">Motivo<textarea name="motivo" minLength={5} maxLength={2000} required className="block w-full rounded border p-2" /></label>}
 {props.modo === "preparar" && <label className="block">Evidência conferida<textarea name="evidencia" minLength={5} maxLength={4000} required className="block w-full rounded border p-2" /></label>}
 {props.modo === "decidir" && <label className="block">Decisão<select name="decisao" className="ml-2 rounded border p-2"><option value="aprovar">Aprovar</option><option value="rejeitar">Rejeitar</option></select></label>}
 </fieldset>
 <button disabled={ocupado} className="rounded border px-3 py-2" type="submit">{ocupado ? "Processando…" : tentativa.current ? "Repetir mesma tentativa" : props.modo === "preparar" ? "Preparar acerto" : props.modo === "decidir" ? "Registrar decisão" : "Aplicar vencimento aprovado"}</button>
 {mensagem && <p role="status">{mensagem}</p>}
 </form>;
}
