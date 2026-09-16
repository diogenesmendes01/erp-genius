import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const mocks=vi.hoisted(()=>({sessao:vi.fn(),consultar:vi.fn()}));
vi.mock("@/server/_shared",()=>({exigirSessaoPagina:mocks.sessao}));
vi.mock("@/server/comunicacoes-agenda/consultas",()=>({consultarAvisosAlteracaoAgenda:mocks.consultar}));
import Page from "./page";
beforeEach(()=>vi.resetAllMocks());
describe("fila de avisos da agenda",()=>{
 it("exige Secretaria/Admin antes da consulta",async()=>{mocks.sessao.mockRejectedValue(new Error("negado"));await expect(Page({searchParams:Promise.resolve({cursor:"c"})})).rejects.toThrow("negado");expect(mocks.sessao).toHaveBeenCalledWith(Papel.SECRETARIA_ACADEMICA,Papel.ADMINISTRADOR);expect(mocks.consultar).not.toHaveBeenCalled();});
 it("mostra pendência paginada sem alegar entrega",async()=>{mocks.sessao.mockResolvedValue({});mocks.consultar.mockResolvedValue({ok:true,dado:{itens:[],proximoCursor:null,pendencias:[{id:"p",matriculaId:"m/a",matriculaCodigo:"M-1",alunoNome:"Ana",motivo:"SEM_DESTINATARIO_AUTORIZADO",situacao:"PENDENTE",criadoEm:new Date("2026-09-16T12:00:00Z"),resolvidaEm:null,resolvidaPorNome:null,observacaoResolucao:null}],proximoCursorPendencia:"proxima /"}});const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({cursor:"outro",pendenciaCursor:"anterior"})}));expect(mocks.consultar).toHaveBeenCalledWith({cursor:"outro",pendenciaCursor:"anterior"});expect(html).toContain("Sem destinatário acadêmico autorizado");expect(html).toContain("/matriculas/m%2Fa/autorizacoes-comunicacao");expect(html).toContain("pendenciaCursor=proxima%20%2F&amp;cursor=outro");expect(html).not.toMatch(/entregue ao aluno/i);});
});