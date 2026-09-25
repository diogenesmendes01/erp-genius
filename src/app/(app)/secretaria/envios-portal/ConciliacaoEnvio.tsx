"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemFilaEnviosPortalAluno } from "@/server/portal-aluno/fila-envios";
import { decidirReemissaoEnvioIncerto, registrarEvidenciaEnvioIncerto } from "@/server/portal-aluno/conciliacao-envio";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";

export function ConciliacaoEnvio({ item, preferenciaFusoExibicao }: { item: ItemFilaEnviosPortalAluno; preferenciaFusoExibicao: string | null }) {
  const router=useRouter(), [mensagem,setMensagem]=useState(""), [ocupado,iniciar]=useTransition();
  const instanteAdministrativo = (valor: Date | string) => {
    const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
    return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
  };
  const registrar=async (f: FormData) => iniciar(async()=>{setMensagem(""); try { const r=await registrarEvidenciaEnvioIncerto({solicitacaoId:item.id,evidencia:String(f.get("evidencia")??"")}); if(!r.ok){setMensagem(r.erro);return;} setMensagem("Evidência registrada.");router.refresh(); }catch{setMensagem(MSG_RESULTADO_INCERTO_SEM_CHAVE);}});
  const decidir=async (f: FormData, aprovar:boolean) => { if(!item.conciliacao)return; iniciar(async()=>{setMensagem("");try{const r=await decidirReemissaoEnvioIncerto({conciliacaoId:item.conciliacao!.id,estadoHash:item.conciliacao!.estadoHash,aprovar,motivo:String(f.get("motivo")??"")});if(!r.ok){setMensagem(r.erro);return;}setMensagem(aprovar?"Nova emissão autorizada e preparada.":"Nova emissão não autorizada.");router.refresh();}catch{setMensagem(MSG_DECISAO_INCERTA);}}); };
  return <div className="mt-2 space-y-2 text-sm">{item.conciliacao&&<div><p>Conferência {item.conciliacao.versao}, registrada por {item.conciliacao.secretariaNome} em {instanteAdministrativo(item.conciliacao.criadaEm)}.</p><p className="whitespace-pre-wrap">{item.conciliacao.evidencia}</p></div>}{item.situacao==="INCERTO"&&item.podeRegistrarEvidencia&&<form action={registrar} className="space-y-1"><label className="block">Evidência da conferência<CampoTexto required minLength={5} maxLength={4000} name="evidencia" className="block w-full border" disabled={ocupado}/></label><button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "sm" })}>Registrar evidência</button></form>}{item.conciliacao&&!item.conciliacao.decisao&&item.podeDecidirReemissao&&<form onSubmit={e=>{e.preventDefault();decidir(new FormData(e.currentTarget),true);}} className="space-y-1"><label className="block">Motivo da decisão<CampoTexto required minLength={5} maxLength={4000} name="motivo" className="block w-full border" disabled={ocupado}/></label><button disabled={ocupado} className={botaoClasses({ tamanho: "sm" })}>Autorizar nova emissão</button><button type="button" disabled={ocupado} onClick={e=>decidir(new FormData(e.currentTarget.form!),false)} className={`${botaoClasses({ variante: "secundario", tamanho: "sm" })} ml-3`}>Não autorizar</button></form>}{item.conciliacao?.decisao?.aprovada&&<p>Nova emissão autorizada em {instanteAdministrativo(item.conciliacao.decisao.decididaEm)}{item.conciliacao.decisao.solicitacaoReemitidaId?". A nova solicitação está preparada.":"."}</p>}{item.conciliacao?.decisao&&!item.conciliacao.decisao.aprovada&&<p>Nova emissão não autorizada em {instanteAdministrativo(item.conciliacao.decisao.decididaEm)}.</p>}<MensagemStatus texto={mensagem} /></div>;
}
