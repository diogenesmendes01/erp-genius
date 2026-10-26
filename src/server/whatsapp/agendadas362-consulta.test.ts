import {beforeEach,expect,it,vi} from "vitest";
import {ErroAutenticacao} from "@/server/_shared/sessao";
const m=vi.hoisted(()=>({sessao:vi.fn(),ler:vi.fn(),db:{$transaction:vi.fn()}}));
vi.mock("@/lib/prisma",()=>({prisma:m.db}));
vi.mock("@/server/_shared",()=>({exigirSessao:m.sessao}));
vi.mock("@/server/inbox/agendadas-leitura",()=>({lerAgendadasDoAtendimento:m.ler}));
vi.mock("./pessoas-atendimento",()=>({contextoPessoas:vi.fn()}));
vi.mock("@/server/aria/resumo-nota",()=>({resumoDaAriaParaNota:vi.fn()}));
import * as consultas from "./consultas-acoes-atendimento";
function consulta(){const fn=(consultas as unknown as Record<string,(id:string)=>Promise<unknown>>).agendadasDoAtendimento;expect(fn,"export público agendadasDoAtendimento").toBeTypeOf("function");return fn!;}
beforeEach(()=>{vi.resetAllMocks();m.sessao.mockResolvedValue({id:"ator"});m.ler.mockResolvedValue([]);});
it("query pública chama leitor canônico com Db e ator da sessão",async()=>{
 const dto=[{id:"i",texto:"Fictício",agendadaPara:"2035-01-02T16:00:00.000Z",status:"PENDENTE",tipo:"TEXTO",temAnexo:false,autor:"voce",autorNome:"Ator",podeAlterar:true}];m.ler.mockResolvedValue(dto);
 expect(await consulta()("a")).toBe(dto);expect(m.ler).toHaveBeenCalledExactlyOnceWith(m.db,"ator","a");expect(m.db.$transaction).not.toHaveBeenCalled();
});
it("query id inválido recusa antes do leitor",async()=>{await expect(consulta()("")).rejects.toThrow();expect(m.ler).not.toHaveBeenCalled();});
it("query sem sessão recusa antes do leitor",async()=>{m.sessao.mockRejectedValue(new ErroAutenticacao());await expect(consulta()("a")).rejects.toThrow("Não autenticado.");expect(m.ler).not.toHaveBeenCalled();});
