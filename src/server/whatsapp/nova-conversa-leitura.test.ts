import { Papel, type Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroAutenticacao, ErroPermissao, ErroRegra } from "@/server/_shared/sessao";
const m = vi.hoisted(() => ({ usuario: vi.fn(), scope: vi.fn(), query: vi.fn() }));
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: m.scope }));
import { lerCadastroNovaConversaTx } from "./nova-conversa-leitura";
const tx = { usuario: { findUnique: m.usuario }, $queryRaw: m.query } as unknown as Prisma.TransactionClient;
const entrada = { autorId: "ator", telefoneE164: "+50688889999" };
const row = () => ({ oportunidadesAutorizadas: [], pessoaIdentificada: false, alunoIdentificado: false, responsavelIdentificado: false, contatoIdentificado: false, oportunidadeOcultaIdentificada: false });
const sql = () => { expect(m.query).toHaveBeenCalled(); return m.query.mock.calls.at(-1)![0] as Prisma.Sql; };
beforeEach(() => {
 for(const f of Object.values(m)) f.mockReset();
 m.usuario.mockResolvedValue({ nome: "Ator fictício", ativo: true, papeis: [Papel.VENDEDOR], permissoes: [] });
 m.scope.mockResolvedValue({ vendedorDonoId: { in: ["ator"] } }); m.query.mockResolvedValue([row()]);
});
describe("reader interno372 parametrizado/escopo fresco", () => {
 it("relê ator e scope na mesma tx e retorna somente projeção mínima", async () => {
  expect(await lerCadastroNovaConversaTx(tx, entrada)).toEqual(row());
  expect(m.usuario).toHaveBeenCalledTimes(1); expect(m.scope).toHaveBeenCalledExactlyOnceWith({ id: "ator", nome: "Ator fictício", papeis: [Papel.VENDEDOR], permissoes: [] }, tx);
  expect(m.query).toHaveBeenCalledTimes(1); expect(sql().sql).toContain('FROM "Lead" l'); expect(sql().sql).toContain('FROM "ContatoWhatsApp" c'); expect(sql().values).toContain("ator");
 });
 it("JSON vazio/null é lista vazia sem fabricar candidato", async () => {
  m.query.mockResolvedValue([{ ...row(), oportunidadesAutorizadas: null }]); expect((await lerCadastroNovaConversaTx(tx, entrada)).oportunidadesAutorizadas).toEqual([]);
 });
 it("sem expected usa limite2 e não escolhe candidato por idade", async () => {
  await lerCadastroNovaConversaTx(tx, entrada); expect(sql().sql).toContain('ORDER BY l."id" LIMIT 2'); expect(sql().sql).not.toContain('"criadoEm"');
 });
 it("expected é ID exato junto de telefone+scope, nunca idINsnapshot", async () => {
  await lerCadastroNovaConversaTx(tx, { ...entrada, leadEsperadoId: "lead-exato" }); expect(sql().sql).toContain('l."id" ='); expect(sql().values).toContain("lead-exato"); expect(sql().values).toContain(entrada.telefoneE164); expect(sql().sql).toContain('ORDER BY l."id" LIMIT 1');
 });
 it("cadastro fora de scope inclui UNKNOWN de ownernull por IS NOT TRUE", async () => {
  await lerCadastroNovaConversaTx(tx, entrada); expect(sql().sql).toContain('l."vendedorDonoId" IN'); expect(sql().sql).toContain('IS NOT TRUE');
 });
 it("parâmetros não são interpolados como SQL ou aliases", async () => {
  const valor = "telefone-ficticio-'--"; await lerCadastroNovaConversaTx(tx, { ...entrada, telefoneE164: valor, leadEsperadoId: "id-'--" });
  expect(sql().sql).not.toContain(valor); expect(sql().sql).not.toContain("id-'--"); expect(sql().values).toContain(valor); expect(sql().values).toContain("id-'--");
 });
 it("witnessContato exige tuple exato e nullbinding não é curinga", async () => {
  await lerCadastroNovaConversaTx(tx, { ...entrada, proprios: { contato: { id: "contato-proprio", telefoneE164: entrada.telefoneE164, pessoaId: null, leadId: null } } });
  expect(sql().sql).toContain('c."pessoaId" IS NOT DISTINCT FROM'); expect(sql().sql).toContain('c."leadId" IS NOT DISTINCT FROM'); expect(sql().sql).toContain('c."alunoId" IS NULL'); expect(sql().sql).toContain('c."responsavelId" IS NULL'); expect(sql().values).toContain("contato-proprio"); expect(sql().values).toContain(null);
 });
 it("witnessLead inclui Pessoa+owner e não exclui Aluno/Responsável externos", async () => {
  await lerCadastroNovaConversaTx(tx, { ...entrada, proprios: { lead: { id: "lead-proprio", telefoneE164: entrada.telefoneE164, pessoaId: "pessoa-propria", vendedorDonoId: "ator" } } });
  expect(sql().sql).toContain('l."pessoaId" ='); expect(sql().values).toContain("pessoa-propria"); expect(sql().values).toContain("lead-proprio");
  const academico = sql().sql.split('FROM "Aluno" a')[1].split('AS "alunoIdentificado"')[0]; expect(academico).not.toContain('a."id"'); expect(academico).not.toContain('IS NOT DISTINCT FROM');
 });
 it("scope é relido por chamada, sem memo do reader", async () => {
  await lerCadastroNovaConversaTx(tx, entrada); m.scope.mockResolvedValue({ vendedorDonoId: { in: ["novo-titular"] } }); await lerCadastroNovaConversaTx(tx, entrada);
  expect(m.scope).toHaveBeenCalledTimes(2); expect(m.usuario).toHaveBeenCalledTimes(2); expect(sql().values).toContain("novo-titular");
 });
 it("inativo/Portal/papel sem alçada são recusados antes da projeção", async () => {
  for(const [usuario, erro] of [[{ ativo: false, papeis: [Papel.VENDEDOR] }, ErroAutenticacao], [{ ativo: true, papeis: [Papel.ALUNO] }, ErroPermissao], [{ ativo: true, papeis: [Papel.FINANCEIRO] }, ErroPermissao]] as const) {
   m.usuario.mockResolvedValue({ nome: "Fictício", permissoes: [], ...usuario }); await expect(lerCadastroNovaConversaTx(tx, entrada)).rejects.toBeInstanceOf(erro);
  }
  expect(m.query).not.toHaveBeenCalled(); expect(m.scope).not.toHaveBeenCalled();
 });
 it("projeção ausente ou JSON inválido falha fechado, nunca vira NOVO", async () => {
  m.query.mockResolvedValue([]); await expect(lerCadastroNovaConversaTx(tx, entrada)).rejects.toBeInstanceOf(ErroRegra);
  m.query.mockResolvedValue([{ ...row(), oportunidadesAutorizadas: { id: "invalido" } }]); await expect(lerCadastroNovaConversaTx(tx, entrada)).rejects.toBeInstanceOf(ErroRegra);
 });
});
