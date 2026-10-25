import { ErroRegra } from "@/server/_shared/sessao";
import { AtualizarInsightSchema } from "./entradas";
import { prepararNovoInsight } from "./claim";
import { iniciarInsight } from "./inicio";
import { finalizarInsight } from "./finalizacao";
import { servicosPadraoInsight,type ServicosGeracaoInsight } from "./gerador";
import { envelopeErroInsight,type EnvelopeInsight } from "./envelope";
import type { BancoInsight } from "./persistencia";

const negado=()=>new ErroRegra("O contexto não está mais autorizado para gerar Insights.");
function confirmado(g:{geracaoId:string;estado:string;versao:number}) {
  return {geracaoId:g.geracaoId,estado:g.estado,versao:g.versao,statusPersistencia:"CONFIRMADA" as const};
}
/** Orquestrador privado: rede uma vez; apenas a persistência do mesmo recibo pode repetir. */
export async function executarAtualizacaoInsight(autorId:string,entrada:unknown,opcoes:{db?:BancoInsight;servicos?:ServicosGeracaoInsight;demo?:boolean}={}) {
  const i=AtualizarInsightSchema.parse(entrada),servicos=opcoes.servicos??servicosPadraoInsight;
  let inicioInput;
  if(i.tipo==="NOVO") {
    const g=await prepararNovoInsight(autorId,{atendimentoId:i.atendimentoId,chaveTentativa:i.chaveTentativa},{db:opcoes.db,disponivel:servicos.disponivel(),demo:opcoes.demo});
    if(g.negado)throw negado();
    if(!g.deveIniciar)return confirmado(g);
    inicioInput={atendimentoId:i.atendimentoId,geracaoId:g.geracaoId,versaoEsperada:g.versao,contextoAtualEsperadoHash:g.contextoAtualEsperadoHash};
  } else {
    inicioInput={atendimentoId:i.atendimentoId,geracaoId:i.geracaoId,versaoEsperada:i.versaoEsperada,contextoAtualEsperadoHash:i.contextoAtualEsperadoHash};
  }
  const inicio=await iniciarInsight(autorId,inicioInput,opcoes.db);
  if(inicio.negado)throw negado();
  if(!inicio.iniciada)return confirmado(inicio);
  let envelope:EnvelopeInsight;
  const inicioRede=performance.now();
  try {
    envelope=await servicos.executar({modelo:inicio.modelo,provedor:inicio.provedor,simulada:inicio.simulada},inicio.pedido);
  } catch(erro) {
    // Uma porta inesperadamente rejeitada não comprova ausência de envio nem custo zero.
    envelope=envelopeErroInsight(erro,inicio.modelo,Math.min(2_147_483_647,Math.max(0,Math.round(performance.now()-inicioRede))));
  }
  const recebidoEm=new Date();
  for(let tentativa=0;tentativa<2;tentativa++) {
    let final;
    try {
      final=await finalizarInsight({atendimentoId:i.atendimentoId,geracaoId:inicio.geracaoId,envelope,recebidoEm},opcoes.db);
    } catch {continue;}
    // Recusa de publicação é posterior ao commit do custo; não é erro de persistência.
    if(!final.autorizado||!final.contextoConfere)throw negado();
    return confirmado(final);
  }
  return {geracaoId:inicio.geracaoId,statusPersistencia:"NAO_CONFIRMADA" as const,resultadoIncerto:true as const,
    estadoConhecidoAntesFinalizacao:inicio.estado,versaoConhecidaAntesFinalizacao:inicio.versao};
}
