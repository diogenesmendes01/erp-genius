import { expect, it, vi } from "vitest";
import { criarIntencaoNovaConversa } from "./intencao-nova-conversa";
const entrada = { modo: "NOVO" as const, telefone: "+50688889999", numeroId: "n", ownerId: "v" };
it("resultado incerto preserva comando, modo e chave através de remontagem do consumidor", async () => {
 const store = criarIntencaoNovaConversa(() => "chave-estavel-372"), enviar = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ok:true,dado:{atendimentoId:"a",criado:true}});
 await store.enviar(entrada,enviar); const primeiro=store.ler(); expect(primeiro.comando).toEqual({...entrada,chaveIdempotencia:"chave-estavel-372"});expect(primeiro.incerto).toBe(true);
 await store.enviar({modo:"EXISTENTE",telefone:entrada.telefone,numeroId:"outra"},enviar);
 expect(enviar.mock.calls[1][0]).toEqual(enviar.mock.calls[0][0]);expect(store.ler().comando).toBeNull();
});
it("trava síncrona rejeita duplicação e não gera nova chave durante busy", async () => {
 const gerar=vi.fn(()=>"chave"),store=criarIntencaoNovaConversa(gerar);type Ack={ok:true;dado:{atendimentoId:string;criado:boolean}};let fim!:(x:Ack)=>void;const action=vi.fn(()=>new Promise<Ack>(r=>{fim=r;}));
 const primeiro=store.enviar(entrada,action);expect(store.ler().ocupado).toBe(true);await store.enviar(entrada,action);expect(action).toHaveBeenCalledTimes(1);expect(gerar).toHaveBeenCalledTimes(1);fim({ok:true,dado:{atendimentoId:"a",criado:true}});await primeiro;
});
it("erro definido preserva tentativa até reinício explícito, incerto não pode ser descartado",async()=>{
 const store=criarIntencaoNovaConversa(()=>"chave");await store.enviar(entrada,async()=>({ok:false,erro:"Acesso mudou"}));expect(store.ler().erro).toBe("Acesso mudou");store.reiniciar();expect(store.ler().comando).toBeNull();await store.enviar(entrada,async()=>{throw Error("rede");});store.reiniciar();expect(store.ler().comando).not.toBeNull();
});
it("EX mantém input mínimo e assinatura observável notifica mudanças",async()=>{
 const store=criarIntencaoNovaConversa(()=>"chave"),ouvinte=vi.fn();const sair=store.assinar(ouvinte),action=vi.fn().mockResolvedValue({ok:false,erro:"Recusado"});await store.enviar({modo:"EXISTENTE",telefone:entrada.telefone,numeroId:"n"},action);expect(action).toHaveBeenCalledWith({modo:"EXISTENTE",telefone:entrada.telefone,numeroId:"n",chaveIdempotencia:"chave"});expect(ouvinte).toHaveBeenCalled();sair();
});