import {expect,it,vi} from "vitest";
import {criarIntencoesAgendamento,type EntradaAgendamento} from "./intencao-agendamento";
const entrada=(id="a"):Extract<EntradaAgendamento,{tipo:"CRIAR"}>=>({tipo:"CRIAR",atendimentoId:id,texto:"Rascunho fictício",quandoLocal:"2035-01-01T09:00",fuso:"America/Sao_Paulo"});
it("donoMap acima da conversa conserva intenção A→B→A e separa operação/intençãodeeditar",()=>{
 const dono=criarIntencoesAgendamento();const a=dono.para(entrada());dono.para(entrada("b"));expect(dono.para(entrada())).toBe(a);
 expect(dono.para({tipo:"REAGENDAR",atendimentoId:"a",intencaoId:"i"})).not.toBe(a);expect(dono.para({tipo:"REAGENDAR",atendimentoId:"a",intencaoId:"i"})).not.toBe(dono.para({tipo:"REAGENDAR",atendimentoId:"a",intencaoId:"j"}));
});
it("incerto preserva input/chave exatos apesar de fechar view ou passar outra entrada",async()=>{
 const gerar=vi.fn(()=>"chave-363");const dono=criarIntencoesAgendamento(gerar);const i=dono.para(entrada());const action=vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ok:true,dado:{id:"ack"}});
 expect((await i.enviar(entrada(),action))?.tipo).toBe("incerto");const comando=i.ler().comando;expect(comando).toMatchObject({...entrada(),chaveIdempotencia:"chave-363"});expect(Object.isFrozen(comando)).toBe(true);
 const cancelar=i.assinar(()=>{});cancelar();dono.para(entrada("b"));i.reiniciar();expect(i.ler().comando).toBe(comando);
 expect((await dono.para(entrada()).enviar({...entrada(),texto:"editado",quandoLocal:"2036-01-01T10:00"},action))?.tipo).toBe("ok");expect(action.mock.calls[1]?.[0]).toBe(comando);expect(gerar).toHaveBeenCalledTimes(1);expect(i.ler()).toMatchObject({ocupado:false,incerto:false,comando:null});
});
it("duplo clique não executa action duas vezes antes de re-render",async()=>{
 let liberar!:(x:{ok:true;dado:{id:string}})=>void;const pending=new Promise<{ok:true;dado:{id:string}}>(r=>liberar=r);const action=vi.fn(()=>pending);const i=criarIntencoesAgendamento(()=>"k").para(entrada());
 const primeiro=i.enviar(entrada(),action);const segundo=i.enviar(entrada(),action);try{expect(action).toHaveBeenCalledTimes(1);expect(i.ler().ocupado).toBe(true);expect(await segundo).toBeNull();}finally{liberar({ok:true,dado:{id:"ack"}});await primeiro;}
});
it("erro conhecido preserva rascunho e só intenção explícita nova muda chave",async()=>{
 let n=0;const i=criarIntencoesAgendamento(()=>"k"+(++n)).para(entrada());const action=vi.fn().mockResolvedValueOnce({ok:false,erro:"Fora do horário"}).mockResolvedValueOnce({ok:true,dado:{id:"ack"}});
 expect((await i.enviar(entrada(),action))?.tipo).toBe("erro");expect(i.ler()).toMatchObject({erro:"Fora do horário",incerto:false});i.reiniciar();await i.enviar({...entrada(),quandoLocal:"2035-01-02T09:00"},action);expect(action.mock.calls.map(x=>x[0].chaveIdempotencia)).toEqual(["k1","k2"]);
});
it("retomar outra view não envia automaticamente e assinantes recebem apenas transições",async()=>{
 const dono=criarIntencoesAgendamento(()=>"k");const i=dono.para(entrada());const ouvir=vi.fn();i.assinar(ouvir);const action=vi.fn().mockRejectedValue(new Error("rede"));await i.enviar(entrada(),action);const chamadas=action.mock.calls.length;dono.para(entrada("b"));dono.para(entrada());expect(action).toHaveBeenCalledTimes(chamadas);expect(ouvir).toHaveBeenCalledTimes(2);
});
it("nega troca de alvo mesmo em recuperação incerta sem chamar action emoutro atendimento",async()=>{
 const dono=criarIntencoesAgendamento(()=>"k");const i=dono.para(entrada());const action=vi.fn().mockRejectedValue(new Error("rede"));await i.enviar(entrada(),action);const antes=i.ler().comando;
 expect((await i.enviar(entrada("b"),action))?.tipo).toBe("erro");expect(action).toHaveBeenCalledTimes(1);expect(i.ler().comando).toBe(antes);expect(i.ler().incerto).toBe(true);
});
it("recusa de acesso ao recuperar incerto não prova rollback e não libera nova intenção",async()=>{
 const i=criarIntencoesAgendamento(()=>"k").para(entrada());const action=vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ok:false,erro:"Atendimento não encontrado."});await i.enviar(entrada(),action);const antes=i.ler().comando;
 await i.enviar(entrada(),action);expect(i.ler().incerto).toBe(true);i.reiniciar();expect(i.ler().comando).toBe(antes);
});
it("owner reencontra operação incerta de reagendar após A→B→A sem enviar automaticamente",async()=>{
 const dono=criarIntencoesAgendamento(()=>"k");const e:EntradaAgendamento={tipo:"REAGENDAR",atendimentoId:"a",intencaoId:"i",quandoLocal:"2035-01-01T09:00",fuso:"UTC"};const i=dono.para(e),action=vi.fn().mockRejectedValue(new Error("rede"));await i.enviar(e,action);dono.para(entrada("b"));
 expect(dono.pendente?.("a")).toMatchObject({alvo:{atendimentoId:"a",tipo:"REAGENDAR",intencaoId:"i"},intencao:i});expect(dono.pendente?.("b")).toBeNull();expect(action).toHaveBeenCalledOnce();
});