import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({recorrencias:vi.fn(),tx:vi.fn(),claim:vi.fn(),ordem:[] as string[]}));
vi.mock("./tarefa-recorrencia-materializacao",()=>({rodarRecorrenciasTarefas:m.recorrencias}));
vi.mock("@/lib/prisma",()=>({prisma:{$transaction:m.tx}}));
import { rodarLembretesTarefas } from "./lembretes";
beforeEach(()=>{vi.clearAllMocks();m.ordem.length=0;m.recorrencias.mockImplementation(async()=>{m.ordem.push("recorrencias");return {criadas:0};});m.claim.mockResolvedValue([]);m.tx.mockImplementation(async f=>{m.ordem.push("lembretes");return f({$queryRaw:m.claim});});});
it("tick existente executa materialização em TX própria antes do fanout sem alterar contador legado",async()=>{expect(await rodarLembretesTarefas(new Date("2026-04-01T00:00:00Z"))).toEqual({notificadas:0});expect(m.recorrencias).toHaveBeenCalledOnce();expect(m.ordem).toEqual(["recorrencias","lembretes"]);});
it("relógio injetável da recorrência é passado sem ler fora da tentativa",async()=>{const agora=vi.fn(()=>new Date("2026-04-01T00:00:00Z"));await rodarLembretesTarefas(new Date(),{agoraRecorrencia:agora});expect(m.recorrencias).toHaveBeenCalledExactlyOnceWith({agora});expect(agora).not.toHaveBeenCalled();});
it("falha infra da materialização propaga e não é convertida em fanout ou sucesso",async()=>{const erro={code:"P2028"};m.recorrencias.mockRejectedValueOnce(erro);await expect(rodarLembretesTarefas(new Date())).rejects.toBe(erro);expect(m.tx).not.toHaveBeenCalled();});