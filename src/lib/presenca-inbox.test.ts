import { describe, expect, it } from "vitest";
import { classificarPresencaInbox, encerrarInscricaoInbox, type InscricaoPresencaInbox } from "./presenca-inbox";
const agora=2_000_000;
const inscricao=(p:Partial<InscricaoPresencaInbox>={}):InscricaoPresencaInbox=>({id:"aba-a",geracao:1,confirmadaEm:agora-1000,ultimoContatoEm:agora,ultimaInteracaoEm:agora-1000,desconectadaEm:null,...p});
describe("D6 classificador puro com instantes recebidos pelo servidor",()=>{
 it("sem inscrição confirmada é offline",()=>expect(classificarPresencaInbox([],agora)).toBe("offline"));
 it("confirmação necessária: conexão não confirmada nunca online",()=>expect(classificarPresencaInbox([inscricao({confirmadaEm:null})],agora)).toBe("offline"));
 it("conexão confirmada e interação recente é online",()=>expect(classificarPresencaInbox([inscricao()],agora)).toBe("online"));
 it.each([599999,600000,600001])("limite de ausência %i ms",idade=>expect(classificarPresencaInbox([inscricao({ultimaInteracaoEm:agora-idade})],agora)).toBe(idade<600000?"online":"ausente"));
 it("sem interação comprovada não fabrica online",()=>expect(classificarPresencaInbox([inscricao({ultimaInteracaoEm:null})],agora)).toBe("ausente"));
 it.each([59999,60000,60001])("um único TTL de desconexão %i ms",idade=>expect(classificarPresencaInbox([inscricao({confirmadaEm:agora-idade-1,ultimoContatoEm:agora-idade})],agora)).toBe(idade<60000?"online":"offline"));
 it("fechamento explícito marca desligada sem fingir batimento e fica offline",()=>{const original=inscricao();const s=encerrarInscricaoInbox(original,{id:"aba-a",geracao:1},agora+1000);expect(s.ultimoContatoEm).toBe(original.ultimoContatoEm);expect(classificarPresencaInbox([s],agora+1000)).toBe("offline");});
 it("atividade recente de inscrição expirada não a ressuscita",()=>expect(classificarPresencaInbox([inscricao({confirmadaEm:agora-100000,ultimoContatoEm:agora-60000,ultimaInteracaoEm:agora-1})],agora)).toBe("offline"));
 it("uma aba viva ativa prevalece sobre outra ausente/expirada",()=>expect(classificarPresencaInbox([inscricao({id:"ausente",ultimaInteracaoEm:agora-700000}),inscricao({id:"expirada",ultimoContatoEm:agora-70000}),inscricao()],agora)).toBe("online"));
 it("atividade de aba expirada não torna online outra aba ausente",()=>expect(classificarPresencaInbox([inscricao({id:"velha",ultimoContatoEm:agora-70000}),inscricao({ultimaInteracaoEm:agora-700000})],agora)).toBe("ausente"));
 it("fechar uma aba não fecha a outra",()=>{const velha=encerrarInscricaoInbox(inscricao(),{id:"aba-a",geracao:1},agora-70000);expect(classificarPresencaInbox([velha,inscricao({id:"aba-b"})],agora)).toBe("online");});
 it("cleanup geração antiga não altera nova inscrição nem objeto de entrada",()=>{const nova=inscricao({geracao:2});expect(encerrarInscricaoInbox(nova,{id:"aba-a",geracao:1},agora)).toBe(nova);expect(nova.desconectadaEm).toBeNull();});
 it("cleanup de outra aba não altera inscrição atual",()=>{const s=inscricao();expect(encerrarInscricaoInbox(s,{id:"outra",geracao:1},agora)).toBe(s);});
 it("geração antiga duplicada não ressuscita geração mais nova não confirmada",()=>expect(classificarPresencaInbox([inscricao(),inscricao({geracao:2,confirmadaEm:null})],agora)).toBe("offline"));
 it("instantes futuros/inválidos não provam presença",()=>{expect(classificarPresencaInbox([inscricao({ultimoContatoEm:agora+1})],agora)).toBe("offline");expect(classificarPresencaInbox([inscricao({ultimaInteracaoEm:NaN})],agora)).toBe("ausente");expect(()=>classificarPresencaInbox([],NaN)).toThrow();});
 it("classificação é determinística e não modifica inscrições",()=>{const s=inscricao();const before={...s};expect(classificarPresencaInbox([s],agora)).toBe(classificarPresencaInbox([s],agora));expect(s).toEqual(before);});
});

it.each([0,1,59000,59999,60000,60001])("cleanup em %i ms nunca renova contato nem ressuscita lease",idade=>{
 const original=inscricao({confirmadaEm:0,ultimoContatoEm:0,ultimaInteracaoEm:0});const antes=classificarPresencaInbox([original],idade);
 const fechado=encerrarInscricaoInbox(original,{id:"aba-a",geracao:1},idade);
 expect(fechado.ultimoContatoEm).toBe(0);expect(fechado.desconectadaEm).toBe(idade);expect(classificarPresencaInbox([fechado],idade)).toBe("offline");
 if(idade>=60000)expect(antes).toBe("offline");
 expect(encerrarInscricaoInbox(fechado,{id:"aba-a",geracao:1},idade+1000)).toBe(fechado);
});
it("cleanup atrasado da geração anterior não fecha nova conexão viva",()=>{const nova=inscricao({geracao:3});const resultado=encerrarInscricaoInbox(nova,{id:"aba-a",geracao:2},agora+60001);expect(resultado).toBe(nova);expect(classificarPresencaInbox([resultado],agora)).toBe("online");});
