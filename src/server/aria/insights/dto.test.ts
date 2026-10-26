import { describe, expect, it } from "vitest";
import { projetarInsightPainel, type LeituraInsightAutorizada } from "./dto";
async function projetar(entrada: LeituraInsightAutorizada) { return projetarInsightPainel(entrada); }
const analise={temperatura:null,chanceFechar:null,sentimento:null,melhorHorario:null,intencao:null,sinais:[],riscos:[],proximoPasso:null,textoSugerido:"Mesmo texto nos dois destinos"};
const entrada=()=>({autorizado:true,capacidadeAtualizar:true,indisponivel:false,emCurso:null,ultima:{id:"g1",geradoEm:new Date("2026-10-25T12:00:00Z"),simulada:false,resultadoJson:analise},novasMensagens:2,contextoAlterado:false});
describe("DTO fechado de Insights",()=>{
  it("nega a projeção sem autorização antes de interpretar resultado",async()=>{
    expect(await projetar({...entrada(),autorizado:false,ultima:{...entrada().ultima,resultadoJson:"invalido"}})).toBeNull();
  });
  it("projeta só apresentação, data ISO e mesmo texto sem envelope interno",async()=>{
    expect(await projetar(entrada())).toEqual({podeAtualizar:true,podeDescartarIncerta:false,estado:"pronto",geracaoEmCursoId:null,ultima:{geracaoId:"g1",geradoEm:"2026-10-25T12:00:00.000Z",simulada:false,analise},novasMensagens:2,contextoAlterado:false});
  });
  it("conserva última análise durante processamento e impede segunda chamada",async()=>{
    expect(await projetar({...entrada(),emCurso:{id:"g2",estado:"PROCESSANDO"}})).toMatchObject({estado:"gerando",podeAtualizar:false,ultima:{geracaoId:"g1"}});
  });
  it("incerto bloqueia atualizar mas permite descarte explícito com a mesma capacidade",async()=>{
    expect(await projetar({...entrada(),emCurso:{id:"g2",estado:"INCERTO"}})).toMatchObject({estado:"incerto",podeAtualizar:false,podeDescartarIncerta:true,geracaoEmCursoId:"g2"});
    expect(await projetar({...entrada(),capacidadeAtualizar:false,emCurso:{id:"g2",estado:"INCERTO"}})).toMatchObject({podeAtualizar:false,podeDescartarIncerta:false});
  });
  it("não transforma cache inválido em análise inventada",async()=>{
    await expect(projetar({...entrada(),ultima:{...entrada().ultima,resultadoJson:{...analise,leadId:"segredo"}}})).rejects.toThrow("Análise de Insights inválida");
  });
  it("vazio e indisponível são estados diferentes sem chamada automática",async()=>{
    expect(await projetar({...entrada(),ultima:null})).toMatchObject({estado:"vazio",ultima:null,podeAtualizar:true});
    expect(await projetar({...entrada(),ultima:null,indisponivel:true})).toMatchObject({estado:"indisponivel",podeAtualizar:false});
  });
});

it("INCERTO com Pessoa incompatível conserva descarte operacional sem gerar/publicar",()=>{
  const dado=projetarInsightPainel({autorizado:true,capacidadeAtualizar:false,capacidadeOperacional:true,indisponivel:false,emCurso:{id:"g-incerta",estado:"INCERTO"},ultima:null,novasMensagens:0,contextoAlterado:false});
  expect(dado).toMatchObject({podeAtualizar:false,podeDescartarIncerta:true,estado:"incerto",ultima:null});
});

it("descarte operacional também exige sua capacidade explícita",()=>{
  expect(projetarInsightPainel({...entrada(),capacidadeOperacional:false,emCurso:{id:"g",estado:"INCERTO"}})?.podeDescartarIncerta).toBe(false);
});
