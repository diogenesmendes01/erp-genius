import { beforeEach, expect, it, vi } from "vitest";
const a=vi.hoisted(()=>({pessoa:vi.fn(),setor:vi.fn(),setorInbox:vi.fn(),resumo:vi.fn(),fila:vi.fn(),aria:vi.fn(),pessoas:vi.fn(),cargas:vi.fn()}));
vi.mock("@/server/whatsapp/transferencia-inbox",()=>({transferirPessoaInbox:a.pessoa,transferirSetorInbox:a.setorInbox}));
vi.mock("@/server/whatsapp/acoes-atendimento",()=>({transferirAtendimento:a.setor,devolverParaFila:a.fila}));
vi.mock("@/server/aria/acoes",()=>({devolverParaAria:a.aria}));
vi.mock("@/server/whatsapp/consultas-acoes-atendimento",()=>({listarPessoasParaAtendimento:a.pessoas,temResumoDaAria:a.resumo,cargaDasPessoas:a.cargas}));
import { carregarPessoasTransferir, carregarResumoTransferir, executarTransferenciaInbox } from "./acoes-transferir";
const base={atendimentoId:"a",contexto:"Contexto fictício",chaveIdempotencia:"chave360"};
beforeEach(()=>{vi.resetAllMocks();a.cargas.mockImplementation(async(_id:string,ids:string[])=>Object.fromEntries(ids.map(id=>[id,0])));for(const fn of [a.pessoa,a.setor,a.setorInbox,a.fila,a.aria])fn.mockResolvedValue({ok:true});});
it("pessoa usa apenas fronteira atômica Inbox, sem uma action posterior de nota",async()=>{await executarTransferenciaInbox({...base,alvo:{tipo:"pessoa",usuarioId:"b"}});expect(a.pessoa).toHaveBeenCalledExactlyOnceWith({...base,usuarioId:"b",anexarResumoAria:false});expect(a.setor).not.toHaveBeenCalled();expect(a.fila).not.toHaveBeenCalled();expect(a.aria).not.toHaveBeenCalled();});
it("369 setor usa opt-in Inbox sem chamar API global",async()=>{await executarTransferenciaInbox({...base,alvo:{tipo:"setor",setor:"SECRETARIA",destinoChave:null}});expect(a.setorInbox).toHaveBeenCalledExactlyOnceWith({...base,destino:"SECRETARIA",destinoChave:null,anexarResumoAria:false});expect(a.setor).not.toHaveBeenCalled();expect(a.pessoa).not.toHaveBeenCalled();});
it("fila preserva apenas atendimentoId e não cria contexto ou resumo",async()=>{await executarTransferenciaInbox({...base,alvo:{tipo:"fila"}});expect(a.fila).toHaveBeenCalledExactlyOnceWith("a");expect(a.pessoa).not.toHaveBeenCalled();expect(a.aria).not.toHaveBeenCalled();});
it("Aria mantém a action histórica e não altera responsável em outra action",async()=>{await executarTransferenciaInbox({...base,alvo:{tipo:"aria"}});expect(a.aria).toHaveBeenCalledExactlyOnceWith("a");expect(a.pessoa).not.toHaveBeenCalled();expect(a.fila).not.toHaveBeenCalled();});
it("erro do servidor é preservado como erro, sem sucesso otimista",async()=>{a.setorInbox.mockResolvedValue({ok:false,erro:"Acesso revogado"});expect(await executarTransferenciaInbox({...base,alvo:{tipo:"setor",setor:"SECRETARIA",destinoChave:null}})).toEqual({ok:false,erro:"Acesso revogado"});});
it("D5: leitura de pessoas usa a alçada transferir do responsável ou gerente",async()=>{a.pessoas.mockResolvedValue([{id:"b",nome:"Pessoa"}]);expect(await carregarPessoasTransferir("a")).toEqual([{id:"b",nome:"Pessoa",carga:0}]);expect(a.pessoas).toHaveBeenCalledExactlyOnceWith("a","transferir");});
it("D5: pessoa leva o booleano de resumo da Aria na mesma ação atômica",async()=>{await executarTransferenciaInbox({...base,alvo:{tipo:"pessoa",usuarioId:"b"},anexarResumoAria:true});expect(a.pessoa).toHaveBeenCalledExactlyOnceWith({...base,usuarioId:"b",anexarResumoAria:true});});
it("369 booleano de resumo vai ao entrypoint novo sem fonte de ação escolhida pelo cliente",async()=>{await executarTransferenciaInbox({...base,alvo:{tipo:"setor",setor:"SECRETARIA",destinoChave:null},anexarResumoAria:true});expect(a.setorInbox).toHaveBeenCalledExactlyOnceWith({...base,destino:"SECRETARIA",destinoChave:null,anexarResumoAria:true});expect(a.setor).not.toHaveBeenCalled();});
it("369 metadado só retorna booleano do atendimento corrente",async()=>{a.resumo.mockResolvedValue(true);expect(await carregarResumoTransferir("a")).toBe(true);expect(a.resumo).toHaveBeenCalledExactlyOnceWith("a");});

it("371 carrega somente IDs da lista autorizada e acrescenta cargas2/0 sem nova permissão",async()=>{
 a.pessoas.mockResolvedValue([{id:"b",nome:"B"},{id:"c",nome:"C"}]);a.cargas.mockResolvedValue({b:2,c:0});
 expect(await carregarPessoasTransferir("a")).toEqual([{id:"b",nome:"B",carga:2},{id:"c",nome:"C",carga:0}]);
 expect(a.cargas).toHaveBeenCalledExactlyOnceWith("a",["b","c"]);
});
it("371 candidato invalidado não recebe zero inventado",async()=>{a.pessoas.mockResolvedValue([{id:"b",nome:"B"},{id:"c",nome:"C"}]);a.cargas.mockResolvedValue({b:2});expect(await carregarPessoasTransferir("a")).toEqual([{id:"b",nome:"B",carga:2}]);});
it("371 lista vazia não consulta carga e erro não vira zero",async()=>{a.pessoas.mockResolvedValue([]);expect(await carregarPessoasTransferir("a")).toEqual([]);expect(a.cargas).not.toHaveBeenCalled();a.pessoas.mockResolvedValue([{id:"b",nome:"B"}]);a.cargas.mockRejectedValue(Error("Falha de leitura"));await expect(carregarPessoasTransferir("a")).rejects.toThrow("Falha de leitura");});
