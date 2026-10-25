import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({db:{},s:vi.fn(),o:vi.fn(),e:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:m.db}));vi.mock("@/lib/auth",()=>({auth:vi.fn()}));vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/server/aria/estado",()=>({situacaoAria:m.s}));vi.mock("@/server/aria/uso",()=>({estadoOrcamento:m.o}));
vi.mock("@/server/whatsapp/escopo",()=>({escopoAtendimentos:m.e}));
import { criarOperacaoListaInbox, resolverOperacaoListaInbox, carregarContextoListaInbox } from "./contexto-lista";
const u={id:"u",nome:"U",papeis:["ADMINISTRADOR"]} as const;
const agora=new Date("2026-10-24T12:00:00.123Z");
const situacao={estado:"ATIVA",pausada:false,versao:{id:"v"}},orcamento={situacao:"OK",acao:"PAUSAR"};
beforeEach(()=>{vi.resetAllMocks();m.s.mockResolvedValue(situacao);m.o.mockResolvedValue(orcamento);m.e.mockResolvedValue(Object.freeze({id:"permitido"}));});
const ator=()=>({...u,papeis:[...u.papeis]});
function deferred<T>(){let resolver!:(v:T)=>void;const promise=new Promise<T>(r=>{resolver=r;});return{promise,resolver};}
describe("operação Inbox344 preguiçosa",()=>{
  it("construção e escopo não inicializam Aria/orçamento",async()=>{
    const op=criarOperacaoListaInbox(ator(),{db:m.db as never,agora});expect(m.e).not.toHaveBeenCalled();expect(m.s).not.toHaveBeenCalled();
    await op.escopo();expect(m.e).toHaveBeenCalledTimes(1);expect(m.s).not.toHaveBeenCalled();expect(m.o).not.toHaveBeenCalled();
  });
  it("memoiza a promessa de escopo antes do await concorrente",async()=>{
    const d=deferred<{id:string}>();m.e.mockReturnValue(d.promise);const op=criarOperacaoListaInbox(ator(),{db:m.db as never,agora,enviar:true});
    const a=op.escopo(),b=op.escopo();expect(a).toBe(b);await Promise.resolve();expect(m.e).toHaveBeenCalledTimes(1);
    d.resolver({id:"permitido"});await Promise.all([a,b]);expect(m.e.mock.calls[0][1]).toEqual({db:m.db,agora,enviar:true});
  });
  it("memoiza global e compartilha escopo com leitores concorrentes",async()=>{
    const d=deferred<typeof situacao>();m.s.mockReturnValue(d.promise);const op=criarOperacaoListaInbox(ator(),{db:m.db as never,agora});
    const a=op.global(),b=op.global(),e=op.escopo();expect(a).toBe(b);await Promise.resolve();expect(m.s).toHaveBeenCalledTimes(1);
    d.resolver(situacao);const [ctx]=await Promise.all([a,b,e]);expect(m.o).toHaveBeenCalledTimes(1);expect(m.e).toHaveBeenCalledTimes(1);
    expect(ctx).toMatchObject({db:m.db,usuarioId:"u",agora,escopo:{id:"permitido"},ariaAtiva:true,aria:{estado:"ATIVA",pausada:false,podeGerenciar:true}});
  });
  it("compatibilidade do loaderM2 e snapshot do relógio/ator",async()=>{
    expect(await carregarContextoListaInbox(m.db as never,ator(),agora)).toMatchObject({usuarioId:"u",ariaAtiva:true});
    const quando=new Date(agora),usuario=ator(),op=criarOperacaoListaInbox(usuario,{db:m.db as never,agora:quando});quando.setTime(0);usuario.papeis.length=0;
    expect((await op.global()).agora.getTime()).toBe(agora.getTime());expect((await op.global()).aria.podeGerenciar).toBe(true);
  });
  it("operação não pode ser reaproveitada para outro ator/Db/envio/instante",()=>{
    const op=criarOperacaoListaInbox(ator(),{db:m.db as never,agora,enviar:true});
    expect(resolverOperacaoListaInbox(ator(),{operacao:op})).toBe(op);
    for(const o of [{db:{}},{enviar:false},{agora:new Date(0)}])expect(()=>resolverOperacaoListaInbox(ator(),{...o,operacao:op} as never)).toThrow();
    expect(()=>resolverOperacaoListaInbox({...ator(),id:"outro"},{operacao:op})).toThrow();
  });
});
