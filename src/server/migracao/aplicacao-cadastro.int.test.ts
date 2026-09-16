import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => { const real = await importOriginal<typeof import("@/server/_shared/sessao")>(); const { prisma } = await import("@/lib/prisma"); return { ...real, exigirSessao: async () => { const id = (await authMock())?.user?.id; const u = id && await prisma.usuario.findUnique({ where: { id } }); if (!u?.ativo) throw new real.ErroAutenticacao(); return u; } }; });
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { prepararLoteMigracao } from "./acoes";
import { aplicarCadastroPreparacaoMigracao } from "./aplicacao-cadastro";
let adminId = "";
const entrar = () => authMock.mockResolvedValue({ user: { id: adminId } });
const linha = (id = "origem-1") => ({ linhaOrigem: "alunos!2", tipoEntrada: "CADASTRO" as const, aluno: { id, nome: "Ana Lima", email: "ana@example.test", documento: "000123", pais: "BR", fuso: "America/Sao_Paulo" } });
async function lote(chave = "lote-1") { const r = await prepararLoteMigracao({ origem: "FONTE", chaveLote: chave, linhas: [linha()] }); if (!r.ok || !r.dado) throw new Error("preparo"); return r.dado.loteId; }
beforeEach(async () => { await truncarBanco(); adminId = (await criarUsuario([Papel.ADMINISTRADOR])).id; entrar(); await prisma.pais.create({ data: { nome: "Brasil", codigoISO: "BR", moedaLocal: "BRL", ddi: "+55", status: "ATIVO" } }); });
it("ensaia, aplica e repete cadastro sem duplicar", async () => { const loteId = await lote(); const ensaio = await aplicarCadastroPreparacaoMigracao({ loteId, modo: "ENSAIO" }); expect(ensaio).toMatchObject({ ok: true, dado: { ensaiadas: 1, bloqueadas: 0, confirmacaoHash: expect.any(String) } }); const hash = ensaio.ok && ensaio.dado?.confirmacaoHash; const aplicado = await aplicarCadastroPreparacaoMigracao({ loteId, modo: "APLICAR", confirmacaoHash: hash }); expect(aplicado).toMatchObject({ ok: true, dado: { aplicadas: 1 } }); expect(await prisma.aluno.findFirstOrThrow({ where: { email: "ana@example.test" } })).toMatchObject({ documento: "000123", aceitaComunicacoes: false, whatsapp: false }); await aplicarCadastroPreparacaoMigracao({ loteId, modo: "APLICAR", confirmacaoHash: hash }); expect(await prisma.aluno.count()).toBe(1); expect(await prisma.mapaOrigemAlunoMigracao.count()).toBe(1); });
it("bloqueia candidato existente e permissão revogada", async () => { const loteId = await lote(); await prisma.aluno.create({ data: { primeiroNome: "Outra", paisId: (await prisma.pais.findFirstOrThrow()).id, email: "ana@example.test" } }); expect(await aplicarCadastroPreparacaoMigracao({ loteId, modo: "ENSAIO" })).toMatchObject({ ok: true, dado: { bloqueadas: 1, ensaiadas: 0 } }); await prisma.usuario.update({ where: { id: adminId }, data: { ativo: false } }); expect(await aplicarCadastroPreparacaoMigracao({ loteId, modo: "ENSAIO" })).toMatchObject({ ok: false }); });
