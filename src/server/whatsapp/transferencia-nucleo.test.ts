import { beforeEach, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ visivel: vi.fn(), evento: vi.fn(), repeticao: vi.fn(), escopo: vi.fn(), encerrar: vi.fn(), garantir: vi.fn(), setores: vi.fn() }));
vi.mock("./atendimentos",()=>({atendimentoVisivel:m.visivel,encerrarAtendimentoNaTransacao:m.encerrar,garantirAtendimento:m.garantir}));
vi.mock("./escopo",()=>({escopoAtendimentos:m.escopo}));
vi.mock("@/server/_shared",()=>({ErroRegra:class extends Error{},ErroPermissao:class extends Error{},registrarEvento:m.evento}));
vi.mock("@/server/_shared/idempotencia",()=>({repeticaoIdempotente:m.repeticao}));
vi.mock("./numero-setor",()=>({setoresDoNumero:m.setores}));
import { atribuirAtendimentoTx } from "./transferencia-nucleo";
const autor={id:"g",nome:"Gerente",ativo:true,papeis:[Papel.GERENTE_COMERCIAL],permissoes:[]};
const alvo={id:"b",ativo:true,papeis:[Papel.VENDEDOR]};
const marca={chaveIdempotencia:"chave",entradaHash:"hash"};
const ordem:string[]=[];
const db={
 $queryRaw:vi.fn(),usuario:{findUnique:vi.fn()},
 atendimentoWhatsApp:{findUnique:vi.fn(),findUniqueOrThrow:vi.fn(),update:vi.fn(),count:vi.fn()},
 intencaoMensagem:{updateMany:vi.fn()},evento:{findFirst:vi.fn()},
};
const tx=()=>db as unknown as Prisma.TransactionClient;
const chamar=(contexto="Nota contextual")=>atribuirAtendimentoTx(tx(),autor,"a","b",{contexto,marca});
beforeEach(()=>{vi.resetAllMocks();ordem.length=0;db.$queryRaw.mockImplementation(async()=>{ordem.push("lock");return[{id:"a"}];});db.usuario.findUnique.mockImplementation(async({where}:{where:{id:string}})=>{ordem.push(where.id==="g"?"ator":"destino");return where.id==="g"?autor:alvo;});m.visivel.mockImplementation(async()=>{ordem.push("visivel");return{id:"a",finalidade:"COMERCIAL",responsavelId:"old",encerradoEm:null};});m.repeticao.mockImplementation(async()=>{ordem.push("idempotencia");return null;});db.atendimentoWhatsApp.findUniqueOrThrow.mockResolvedValue({status:"EM_ATENDIMENTO",responsavelId:"old"});db.atendimentoWhatsApp.count.mockResolvedValue(1);db.atendimentoWhatsApp.findUnique.mockResolvedValue({finalidade:"COMERCIAL",conversa:{numero:{finalidade:"AGENDA"}}});m.escopo.mockResolvedValue({});});
it("default histórico mantém payload e não cria contexto nem relê ator",async()=>{await atribuirAtendimentoTx(tx(),autor,"a","b");expect(m.repeticao).not.toHaveBeenCalled();expect(ordem).toEqual(["lock","visivel","destino"]);expect(m.evento).toHaveBeenCalledOnce();expect(m.evento.mock.calls[0][1].payload).toEqual({de:"old",para:"b"});});
it("Inbox: idempotência antes do pai, ator fresco depois, atribuição e nota na mesma tx",async()=>{await chamar();expect(ordem.slice(0,5)).toEqual(["idempotencia","lock","ator","visivel","destino"]);expect(m.evento.mock.calls.map(c=>c[1].tipo)).toEqual(["AtendimentoAtribuido","NotaInterna"]);expect(m.evento.mock.calls.every(c=>c[0]===tx())).toBe(true);expect(m.evento.mock.calls[1][1]).toMatchObject({agregadoId:"a",autorId:"g",payload:{nota:"Nota contextual"}});expect(db.intencaoMensagem.updateMany).toHaveBeenCalledWith({where:{atendimentoId:"a",origem:"HUMANO",autorId:"old",status:{in:["PENDENTE","ADIADA"]}},data:{status:"CANCELADA",motivoFalha:"Responsável do atendimento mudou; revisar antes de enviar."}});});
it("ator revogado durante espera não usa a sessão prévia",async()=>{db.usuario.findUnique.mockImplementation(async({where}:{where:{id:string}})=>where.id==="g"?{...autor,ativo:false}:alvo);await expect(chamar()).rejects.toThrow();expect(db.atendimentoWhatsApp.update).not.toHaveBeenCalled();expect(m.evento).not.toHaveBeenCalled();});
it("contexto vazio não grava nota",async()=>{await chamar("");expect(m.evento.mock.calls.map(c=>c[1].tipo)).toEqual(["AtendimentoAtribuido"]);});
it("replay exige ator/cap/destino frescos e não repete evento/nota",async()=>{m.repeticao.mockResolvedValue({payload:{para:"b"}});m.visivel.mockResolvedValue({id:"a",finalidade:"COMERCIAL",responsavelId:"b",encerradoEm:null});db.atendimentoWhatsApp.findUniqueOrThrow.mockResolvedValue({status:"EM_ATENDIMENTO",responsavelId:"b"});db.evento.findFirst.mockResolvedValue({tipo:"AtendimentoAtribuido",autorId:"g",payload:{para:"b",chaveIdempotencia:"chave"}});await chamar();expect(db.usuario.findUnique).toHaveBeenCalledWith(expect.objectContaining({where:{id:"g"}}));expect(db.usuario.findUnique).toHaveBeenCalledWith(expect.objectContaining({where:{id:"b"}}));expect(m.evento).not.toHaveBeenCalled();expect(db.atendimentoWhatsApp.update).not.toHaveBeenCalled();});
it("replay de dono posterior divergente não vira sucesso",async()=>{m.repeticao.mockResolvedValue({payload:{para:"b"}});await expect(chamar()).rejects.toThrow();expect(m.evento).not.toHaveBeenCalled();});
it("replay também exige que o destino ainda enxergue o atendimento após revogação contextual",async()=>{m.repeticao.mockResolvedValue({payload:{para:"b"}});m.visivel.mockResolvedValue({id:"a",finalidade:"COMERCIAL",responsavelId:"b",encerradoEm:null});db.atendimentoWhatsApp.findUniqueOrThrow.mockResolvedValue({status:"EM_ATENDIMENTO",responsavelId:"b"});db.evento.findFirst.mockResolvedValue({tipo:"AtendimentoAtribuido",autorId:"g",payload:{para:"b",chaveIdempotencia:"chave"}});db.atendimentoWhatsApp.count.mockResolvedValue(0);await expect(chamar()).rejects.toThrow("Esta pessoa não teria acesso");expect(m.evento).not.toHaveBeenCalled();});
