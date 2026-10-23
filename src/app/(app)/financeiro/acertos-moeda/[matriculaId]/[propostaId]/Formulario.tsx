"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { proporMoedaAditivo, decidirMoedaAditivo, aplicarMoedaAditivo } from "@/server/contratos/moeda-aditivo";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { CampoTexto } from "@/components/CampoTexto";

type Props = { modo: "preparar" | "decidir" | "aplicar"; propostaId?: string; matriculaId?: string; versaoCondicoesId?: string; revisaoHash?: string };

/**
 * Q173: troca de moeda por aditivo. A chave de idempotência (#166) é a mesma enquanto a tentativa não foi
 * confirmada; na falha de transporte, a entrada também fica preservada e reenviar consulta a mesma operação.
 * Recusa conhecida (regra, permissão, sessão, entrada) não grava nada no servidor: libera corrigir os dados.
 */
export function MoedaFormulario(props: Props) {
 const router = useRouter();
 const acao = useAcaoCliente({ idempotente: true });
 const chave = useChaveIdempotencia();
 const [concluido,setConcluido] = useState(false);
 const [temTentativa,setTemTentativa] = useState(false);
 const emEnvio = useRef(false);
 const tentativa = useRef<Record<string,unknown> | null>(null);
 return <form className="space-y-3 rounded border p-3" onSubmit={async evento => {
  evento.preventDefault(); if (acao.ocupado || emEnvio.current || concluido) return;
  const form = new FormData(evento.currentTarget);
  if (!tentativa.current) tentativa.current = props.modo === "preparar"
   ? { matriculaId: props.matriculaId, versaoCondicoesId: props.versaoCondicoesId, revisaoHash: props.revisaoHash, motivo: form.get("motivo"), evidencia: form.get("evidencia") }
   : props.modo === "decidir" ? { propostaId: props.propostaId, aprovada: form.get("decisao") === "aprovar", motivo: form.get("motivo") } : { propostaId: props.propostaId };
  setTemTentativa(true);
  emEnvio.current = true;
  try {
   const entrada = { ...tentativa.current, chaveIdempotencia: chave.atual };
   const resposta: { podeRevisar?: boolean } = {};
   const d = await acao.executar<unknown>(async () => {
    const r = await (props.modo === "preparar" ? proporMoedaAditivo(entrada) : props.modo === "decidir" ? decidirMoedaAditivo(entrada) : aplicarMoedaAditivo(entrada));
    if (!r.ok) resposta.podeRevisar = r.podeRevisar;
    return r;
   }, "Operação registrada.");
   chave.depoisDo(d);
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
 <button disabled={acao.ocupado || concluido} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} type="submit">{concluido ? "Registrado" : acao.ocupado ? "Processando…" : temTentativa ? "Repetir mesma tentativa" : props.modo === "preparar" ? "Preparar troca de moeda" : props.modo === "decidir" ? "Registrar decisão" : "Aplicar troca de moeda aprovada"}</button>
 <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
 </form>;
}
