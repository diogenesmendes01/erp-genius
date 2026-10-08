"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { proporVencimentoAditivo, decidirVencimentoAditivo, aplicarVencimentoAditivo } from "@/server/contratos/vencimento-aditivo";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";

type Props = { modo: "preparar" | "decidir" | "aplicar"; propostaId?: string; matriculaId?: string; versaoCondicoesId?: string; revisaoHash?: string };
export function VencimentoFormulario(props: Props) {
 const router = useRouter();
 // Chave de idempotência estável entre tentativas: na falha de transporte, reenviar confere a mesma operação.
 const acao = useAcaoCliente({ idempotente: true });
 const [concluido,setConcluido] = useState(false);
 const [temTentativa,setTemTentativa] = useState(false);
 const emEnvio = useRef(false);
 const tentativa = useRef<{ entrada: Record<string,unknown>; chave: string } | null>(null);
 return <form className="space-y-3 rounded border p-3" onSubmit={async evento => {
  evento.preventDefault(); if (acao.ocupado || emEnvio.current || concluido) return;
  const form = new FormData(evento.currentTarget);
  if (!tentativa.current) tentativa.current = { chave: crypto.randomUUID(), entrada: props.modo === "preparar"
   ? { matriculaId: props.matriculaId, versaoCondicoesId: props.versaoCondicoesId, revisaoHash: props.revisaoHash, motivo: form.get("motivo"), evidencia: form.get("evidencia") }
   : props.modo === "decidir" ? { propostaId: props.propostaId, aprovada: form.get("decisao") === "aprovar", motivo: form.get("motivo") } : { propostaId: props.propostaId } };
  setTemTentativa(true);
  emEnvio.current = true;
  try {
   const entrada = { ...tentativa.current.entrada, chaveIdempotencia: tentativa.current.chave };
   // O servidor diz se a recusa admite corrigir os dados (nova tentativa) ou se a tentativa fica preservada.
   const resposta: { podeRevisar?: boolean } = {};
   const d = await acao.executar<unknown>(async () => {
    const r = await (props.modo === "preparar" ? proporVencimentoAditivo(entrada) : props.modo === "decidir" ? decidirVencimentoAditivo(entrada) : aplicarVencimentoAditivo(entrada));
    if (!r.ok) resposta.podeRevisar = r.podeRevisar;
    return r;
   }, "Operação registrada.");
   if (d?.tipo === "ok") { setConcluido(true); router.refresh(); }
   else if (d?.tipo === "erro" && resposta.podeRevisar) { tentativa.current = null; setTemTentativa(false); acao.setErro(d.mensagem + " Corrija os dados antes de tentar novamente."); }
   else if (d?.tipo === "erro") acao.setErro(d.mensagem + " A tentativa foi preservada; confira o histórico antes de iniciar outra operação.");
  } finally { emEnvio.current = false; }
 }}>
 <fieldset disabled={acao.ocupado || temTentativa} className="space-y-2">
 {props.modo !== "aplicar" && <label className="block">Motivo<CampoTexto name="motivo" minLength={5} maxLength={2000} required className="block w-full rounded border p-2" /></label>}
 {props.modo === "preparar" && <label className="block">Evidência conferida<CampoTexto name="evidencia" minLength={5} maxLength={4000} required className="block w-full rounded border p-2" /></label>}
 {props.modo === "decidir" && <label className="block">Decisão<select name="decisao" className="ml-2 rounded border p-2"><option value="aprovar">Aprovar</option><option value="rejeitar">Rejeitar</option></select></label>}
 </fieldset>
 <button disabled={acao.ocupado || concluido} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} type="submit">{concluido ? "Registrado" : acao.ocupado ? "Processando…" : temTentativa ? "Repetir mesma tentativa" : props.modo === "preparar" ? "Preparar acerto" : props.modo === "decidir" ? "Registrar decisão" : "Aplicar vencimento aprovado"}</button>
 <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
 </form>;
}
