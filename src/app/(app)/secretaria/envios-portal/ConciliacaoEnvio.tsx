"use client";
import { useRouter } from "next/navigation";
import type { ItemFilaEnviosPortalAluno } from "@/server/portal-aluno/fila-envios";
import { decidirReemissaoEnvioIncerto, registrarEvidenciaEnvioIncerto } from "@/server/portal-aluno/conciliacao-envio";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { useAcaoCliente } from "@/lib/acao-cliente";

export function ConciliacaoEnvio({ item, preferenciaFusoExibicao }: { item: ItemFilaEnviosPortalAluno; preferenciaFusoExibicao: string | null }) {
  const router=useRouter();
  // Evidência sem chave de idempotência: na falha de transporte, conferir antes de repetir (MSG_RESULTADO_INCERTO_SEM_CHAVE).
  const registro=useAcaoCliente({ idempotente: false });
  // Decisão sem chave; na falha de transporte vale a mensagem própria de decisão (MSG_DECISAO_INCERTA).
  const decisao=useAcaoCliente({ idempotente: false });
  const ocupado=registro.ocupado||decisao.ocupado;
  const instanteAdministrativo = (valor: Date | string) => {
    const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
    return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
  };
  const registrar=async (f: FormData) => { const d=await registro.executar(()=>registrarEvidenciaEnvioIncerto({solicitacaoId:item.id,evidencia:String(f.get("evidencia")??"")}),"Evidência registrada."); if(d?.tipo==="ok")router.refresh(); };
  const decidir=async (f: FormData, aprovar:boolean) => { if(!item.conciliacao)return; const conciliacao=item.conciliacao; const d=await decisao.executar(()=>decidirReemissaoEnvioIncerto({conciliacaoId:conciliacao.id,estadoHash:conciliacao.estadoHash,aprovar,motivo:String(f.get("motivo")??"")}),aprovar?"Nova emissão autorizada e preparada.":"Nova emissão não autorizada."); if(d?.tipo==="incerto")decisao.setErro(MSG_DECISAO_INCERTA); if(d?.tipo==="ok")router.refresh(); };
  return <div className="mt-2 space-y-2 text-sm">{item.conciliacao&&<div><p>Conferência {item.conciliacao.versao}, registrada por {item.conciliacao.secretariaNome} em {instanteAdministrativo(item.conciliacao.criadaEm)}.</p><p className="whitespace-pre-wrap">{item.conciliacao.evidencia}</p></div>}{item.situacao==="INCERTO"&&item.podeRegistrarEvidencia&&<form action={registrar} className="space-y-1"><label className="block">Evidência da conferência<CampoTexto required minLength={5} maxLength={4000} name="evidencia" className="block w-full border" disabled={ocupado}/></label><button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "sm" })}>Registrar evidência</button></form>}<FeedbackAcao erro={registro.erro} sucesso={registro.sucesso} />{item.conciliacao&&!item.conciliacao.decisao&&item.podeDecidirReemissao&&<form onSubmit={e=>{e.preventDefault();return decidir(new FormData(e.currentTarget),true);}} className="space-y-1"><label className="block">Motivo da decisão<CampoTexto required minLength={5} maxLength={4000} name="motivo" className="block w-full border" disabled={ocupado}/></label><button disabled={ocupado} className={botaoClasses({ tamanho: "sm" })}>Autorizar nova emissão</button><button type="button" disabled={ocupado} onClick={e=>decidir(new FormData(e.currentTarget.form!),false)} className={`${botaoClasses({ variante: "secundario", tamanho: "sm" })} ml-3`}>Não autorizar</button></form>}<FeedbackAcao erro={decisao.erro} sucesso={decisao.sucesso} />{item.conciliacao?.decisao?.aprovada&&<p>Nova emissão autorizada em {instanteAdministrativo(item.conciliacao.decisao.decididaEm)}{item.conciliacao.decisao.solicitacaoReemitidaId?". A nova solicitação está preparada.":"."}</p>}{item.conciliacao?.decisao&&!item.conciliacao.decisao.aprovada&&<p>Nova emissão não autorizada em {instanteAdministrativo(item.conciliacao.decisao.decididaEm)}.</p>}</div>;
}
