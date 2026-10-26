import { expect, it } from "vitest";
import { TransferirPessoaInboxSchema } from "./entrada-transferencia-inbox";
const base={atendimentoId:"a",usuarioId:"b",chaveIdempotencia:"c0e59fa6-ef3b-423a-b494-8f587fb82cdd"};
it("contexto de pessoa é opcional e normalizado, sem mudar o schema histórico",()=>{expect(TransferirPessoaInboxSchema.parse(base).contexto).toBe("");expect(TransferirPessoaInboxSchema.parse({...base,contexto:"  Nota  "}).contexto).toBe("Nota");});
it("limite e alvo/chave continuam obrigatórios",()=>{expect(TransferirPessoaInboxSchema.safeParse({...base,contexto:"x".repeat(1001)}).success).toBe(false);expect(TransferirPessoaInboxSchema.safeParse({...base,usuarioId:""}).success).toBe(false);expect(TransferirPessoaInboxSchema.safeParse({...base,chaveIdempotencia:""}).success).toBe(false);});
it("nenhuma flag de cliente entra nos dados autorizadores ou hash",()=>{const dados=TransferirPessoaInboxSchema.parse({...base,contexto:"Contexto suficiente",permitirSemCarteira:true,fresh:false,modo:"global"});expect(Object.keys(dados).sort()).toEqual(["atendimentoId","chaveIdempotencia","contexto","usuarioId"]);});
