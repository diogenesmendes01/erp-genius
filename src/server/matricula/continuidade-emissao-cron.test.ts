import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({findMany:vi.fn(),tx:vi.fn(),emitir:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{matricula:{findMany:m.findMany},$transaction:m.tx}}));
vi.mock("./continuidade-emissao-tx",()=>({emitirContinuidadeMensalTx:m.emitir}));
import { rodarEmissaoMensalContinuidade } from "./continuidade-emissao-cron";
beforeEach(()=>{vi.resetAllMocks();m.tx.mockImplementation((f: (tx: object) => unknown)=>f({}));m.emitir.mockResolvedValue({repetida:false});vi.spyOn(console,"error").mockImplementation(()=>{});});
it("pagina mais de cinquenta matrículas sem repetir",async()=>{const a=Array.from({length:50},(_,i)=>({id:`${String(i).padStart(3,"0")}`,cobrancas:[{id:`c${i}`}] }));const b=[{id:"999",cobrancas:[{id:"c999"}]}];m.findMany.mockResolvedValueOnce(a).mockResolvedValueOnce(b);expect(await rodarEmissaoMensalContinuidade()).toMatchObject({avaliadas:51,emitidas:51,proximoCursor:null});expect(m.emitir).toHaveBeenCalledTimes(51);});
it("isola pendência e falha de infraestrutura",async()=>{m.findMany.mockResolvedValue([{id:"a",cobrancas:[{id:"c"}]},{id:"b",cobrancas:[{id:"d"}]}]);const {ErroRegra}=await import("@/server/_shared");m.emitir.mockRejectedValueOnce(new ErroRegra("pendente")).mockRejectedValueOnce(new Error("infra"));expect(await rodarEmissaoMensalContinuidade()).toMatchObject({pendentes:1,falhas:1,emitidas:0});});

