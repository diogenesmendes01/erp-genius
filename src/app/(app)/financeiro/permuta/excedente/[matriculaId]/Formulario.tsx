"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { prepararDestinacaoExcedentePermuta, registrarConcordanciaExcedentePermuta, decidirDestinacaoExcedentePermuta } from "@/server/matricula/excedente-permuta-destinacao";

type Origem = { id: string; tipo: string; valor: string };
type Props =
 | { modo: "preparar"; matriculaId: string; cobrancaId: string; moeda: string; origens: Origem[] }
 | { modo: "concordar"; propostaId: string; parte: "ALUNO_OU_RESPONSAVEL" | "ESCOLA" }
 | { modo: "decidir"; propostaId: string };

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();

/** A chave de idempotência é mantida entre repetições da mesma tentativa; erro de regra libera nova tentativa. */
export function ExcedenteFormulario(props: Props) {
 const router = useRouter();
 const [ocupado,setOcupado] = useState(false), [mensagem,setMensagem] = useState("");
 const [concluido,setConcluido] = useState(false), [preservada,setPreservada] = useState(false);
 const emEnvio = useRef(false);
 const tentativa = useRef<{ entrada: Record<string,unknown>; chave: string } | null>(null);
 const mista = props.modo === "preparar" && props.origens.length > 1;
 return <form className="space-y-3 rounded border p-3" onSubmit={async evento => {
  evento.preventDefault(); if (ocupado || emEnvio.current || concluido) return;
  const form = new FormData(evento.currentTarget);
  if (!tentativa.current) {
   let entrada: Record<string,unknown>;
   if (props.modo === "preparar") {
    const itens = (["SALDO_SERVICOS", "CREDITO_FINANCEIRO"] as const).map(tipo => ({ tipo, valor: texto(form, tipo) })).filter(i => i.valor && i.valor !== "0" && i.valor !== "0.00");
    const distribuicao = mista ? props.origens.map(o => ({ origemId: o.id, valor: texto(form, `origem-${o.id}`) })).filter(x => x.valor) : undefined;
    entrada = { matriculaId: props.matriculaId, cobrancaId: props.cobrancaId, valorDevidoAcordado: texto(form, "valorDevidoAcordado"), itens, motivo: texto(form, "motivo"), ...(distribuicao ? { distribuicao } : {}) };
   } else if (props.modo === "concordar") {
    entrada = { propostaId: props.propostaId, parte: props.parte, nomeDeclarante: texto(form, "nomeDeclarante"), meio: texto(form, "meio"), evidencia: texto(form, "evidencia") };
   } else entrada = { propostaId: props.propostaId, aprovada: form.get("decisao") === "aprovar", motivo: texto(form, "motivo") };
   tentativa.current = { chave: crypto.randomUUID(), entrada };
  }
  emEnvio.current = true; setOcupado(true); setPreservada(true); setMensagem("");
  try {
   const entrada = tentativa.current.entrada;
   const r = await (props.modo === "preparar" ? prepararDestinacaoExcedentePermuta({ ...entrada, chaveIdempotencia: tentativa.current.chave } as Parameters<typeof prepararDestinacaoExcedentePermuta>[0])
    : props.modo === "concordar" ? registrarConcordanciaExcedentePermuta(entrada as Parameters<typeof registrarConcordanciaExcedentePermuta>[0])
    : decidirDestinacaoExcedentePermuta(entrada as Parameters<typeof decidirDestinacaoExcedentePermuta>[0]));
   if (r.ok) { setConcluido(true); setMensagem("Operação registrada."); router.refresh(); }
   else { tentativa.current = null; setPreservada(false); setMensagem(r.erro + " Confira o histórico antes de tentar novamente."); }
  } catch { setMensagem("Resultado não confirmado. Repita para consultar a mesma tentativa."); }
  finally { emEnvio.current = false; setOcupado(false); }
 }}>
 <fieldset disabled={ocupado || preservada} className="space-y-2">
 {props.modo === "preparar" && <>
  <label className="block">Obrigação acordada ({props.moeda})<input name="valorDevidoAcordado" required inputMode="decimal" pattern="^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$" className="ml-2 rounded border p-2" /></label>
  {mista && <fieldset className="space-y-1 rounded border p-2"><legend>Distribuição da redução por origem (a soma é a diferença entre o liquidado e a obrigação)</legend>
   {props.origens.map(o => <label key={o.id} className="block">{o.tipo} · {o.valor} {props.moeda} · {o.id}<input name={`origem-${o.id}`} inputMode="decimal" pattern="^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$" className="ml-2 rounded border p-2" /></label>)}
  </fieldset>}
  <label className="block">Saldo restrito a serviços ({props.moeda})<input name="SALDO_SERVICOS" inputMode="decimal" pattern="^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$" className="ml-2 rounded border p-2" /></label>
  <label className="block">Crédito financeiro ({props.moeda})<input name="CREDITO_FINANCEIRO" inputMode="decimal" pattern="^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$" className="ml-2 rounded border p-2" /></label>
  <p className="text-sm">Os destinos precisam somar exatamente o excedente de serviço apurado. Nada é alterado até a aprovação.</p>
 </>}
 {props.modo === "concordar" && <>
  <label className="block">Nome de quem declarou<input name="nomeDeclarante" required minLength={2} maxLength={200} className="ml-2 rounded border p-2" /></label>
  <label className="block">Meio (presencial, WhatsApp, e-mail…)<input name="meio" required minLength={2} maxLength={100} className="ml-2 rounded border p-2" /></label>
  <label className="block">Evidência (texto; anexo opcional pelo prontuário)<textarea name="evidencia" minLength={5} maxLength={4000} required className="block w-full rounded border p-2" /></label>
 </>}
 {props.modo !== "concordar" && <label className="block">Motivo<textarea name="motivo" minLength={5} maxLength={2000} required className="block w-full rounded border p-2" /></label>}
 {props.modo === "decidir" && <label className="block">Decisão<select name="decisao" className="ml-2 rounded border p-2"><option value="aprovar">Aprovar</option><option value="rejeitar">Rejeitar</option></select></label>}
 </fieldset>
 <button disabled={ocupado || concluido} className="rounded border px-3 py-2" type="submit">{concluido ? "Registrado" : ocupado ? "Processando…" : preservada ? "Repetir mesma tentativa" : props.modo === "preparar" ? "Propor destinação" : props.modo === "concordar" ? (props.parte === "ESCOLA" ? "Registrar concordância da escola" : "Registrar concordância do aluno/responsável") : "Registrar decisão"}</button>
 {mensagem && <p role="status">{mensagem}</p>}
 </form>;
}
