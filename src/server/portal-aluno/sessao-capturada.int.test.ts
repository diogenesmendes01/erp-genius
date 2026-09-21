import { beforeEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { criarSessaoPortalAlunoTx, revalidarSessaoPortalAlunoTx, type SessaoPortalAluno } from "./sessao";

let sessao: SessaoPortalAluno;
let outraContaId: string;

async function revalidar(capturada = sessao) {
  return prisma.$transaction((tx) => revalidarSessaoPortalAlunoTx(tx, capturada));
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  const [aluno, outroAluno] = await Promise.all([
    prisma.aluno.create({ data: { primeiroNome: "Aluna da sessão", paisId: catalogo.pais.id } }),
    prisma.aluno.create({ data: { primeiroNome: "Outro aluno", paisId: catalogo.pais.id } }),
  ]);
  const [conta, outraConta] = await Promise.all([
    prisma.contaPortalAluno.create({ data: {
      alunoId: aluno.id, ativa: true, emailVerificado: "aluna@sessao.test", emailVerificadoEm: new Date(), senhaHash: "hash-da-senha",
    } }),
    prisma.contaPortalAluno.create({ data: {
      alunoId: outroAluno.id, ativa: true, emailVerificado: "outro@sessao.test", emailVerificadoEm: new Date(), senhaHash: "hash-da-senha",
    } }),
  ]);
  outraContaId = outraConta.id;
  const criada = await prisma.$transaction((tx) => criarSessaoPortalAlunoTx(tx, {
    contaId: conta.id, versaoConta: conta.versaoSessao,
    prazos: { sessaoMinutos: 60, conviteMinutos: 60, recuperacaoMinutos: 60, validacaoEmailMinutos: 60 },
  }));
  sessao = { sessaoId: criada.id, contaId: conta.id, alunoId: aluno.id, email: "aluna@sessao.test" };
});

it("aceita a sessão persistida ainda válida sem depender de cookie", async () => {
  await expect(revalidar()).resolves.toBeUndefined();
});

it("recusa a sessão revogada depois da captura", async () => {
  await prisma.sessaoPortalAluno.update({ where: { id: sessao.sessaoId }, data: { revogadaEm: new Date() } });
  await expect(revalidar()).rejects.toThrow("Sessão do aluno inválida ou expirada");
});

it("recusa a sessão expirada depois da captura", async () => {
  await prisma.sessaoPortalAluno.update({ where: { id: sessao.sessaoId }, data: { expiraEm: new Date(Date.now() - 1_000) } });
  await expect(revalidar()).rejects.toThrow("Sessão do aluno inválida ou expirada");
});

it("recusa alteração da versão da conta depois da captura", async () => {
  await prisma.contaPortalAluno.update({ where: { id: sessao.contaId }, data: { versaoSessao: { increment: 1 } } });
  await expect(revalidar()).rejects.toThrow("Sessão do aluno inválida ou expirada");
});

it("recusa conta desativada depois da captura", async () => {
  await prisma.contaPortalAluno.update({ where: { id: sessao.contaId }, data: { ativa: false } });
  await expect(revalidar()).rejects.toThrow("Sessão do aluno inválida ou expirada");
});

it.each([
  ["conta", () => ({ ...sessao, contaId: outraContaId })],
  ["aluno", () => ({ ...sessao, alunoId: "aluno-divergente" })],
])("recusa snapshot com %s divergente", async (_campo, alterar) => {
  await expect(revalidar(alterar())).rejects.toThrow("Sessão do aluno inválida ou expirada");
});
