import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { decidirDisponibilidadeOferta, proporDisponibilidadeOferta } from "./disponibilidade-oferta";
import { conferirDisponibilidadeOfertaTx } from "./disponibilidade-oferta-tx";
import { registrarRelatoIndisponibilidadeOferta } from "./indisponibilidade-oferta-relato";

let matriculaId: string, secretariaId: string, gestorId: string;
const entrada = (chave = "disponibilidade-1") => ({ matriculaId, inicio: "2026-10-01", fim: "2026-10-31", motivo: "Gestão verificou continuidade no período", evidenciaTexto: "Fonte de oferta conferida para a matrícula no intervalo completo", chaveIdempotencia: chave });
const estado = () => prisma.$transaction((tx) => conferirDisponibilidadeOfertaTx(tx, { matriculaId, inicio: "2026-10-01", fim: "2026-10-31" }));

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Oferta positiva", paisId: catalogo.pais.id } });
  matriculaId = (await prisma.matricula.create({ data: { alunoId: aluno.id, paisId: catalogo.pais.id, produtoId: catalogo.produto.id, moeda: "CRC" } })).id;
  authMock.mockResolvedValue({ user: { id: secretariaId } });
});

it("aprova uma provisão independente, imutável e ainda sem emitir cobrança", async () => {
  const proposta = await proporDisponibilidadeOferta(entrada());
  expect(proposta).toMatchObject({ ok: true, dado: { versao: 1 } });
  expect(await proporDisponibilidadeOferta(entrada())).toEqual(proposta);
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  authMock.mockResolvedValue({ user: { id: gestorId } });
  expect(await decidirDisponibilidadeOferta({ propostaId: proposta.dado.id, aprovada: true, motivo: "Oferta conferida por pessoa independente", evidenciaTexto: "Gestão revisou a fonte de agenda e o intervalo" })).toMatchObject({ ok: true });
  expect(await estado()).toMatchObject({ disponivel: true, consumivel: true });
  expect(await prisma.cobranca.count()).toBe(0);
  await expect(prisma.propostaDisponibilidadeOfertaMatricula.updateMany({ data: { motivo: "alteração" } })).rejects.toThrow();
  await expect(prisma.decisaoDisponibilidadeOfertaMatricula.deleteMany()).rejects.toThrow();
});

it("não permite autoaprovação e uma versão nova do mesmo intervalo invalida a anterior", async () => {
  const primeira = await proporDisponibilidadeOferta(entrada());
  if (!primeira.ok || !primeira.dado) throw new Error(JSON.stringify(primeira));
  await prisma.usuario.update({ where: { id: secretariaId }, data: { papeis: ["SECRETARIA_ACADEMICA", "ADMINISTRADOR"] } });
  expect(await decidirDisponibilidadeOferta({ propostaId: primeira.dado.id, aprovada: true, motivo: "Tentativa própria de aprovação", evidenciaTexto: "O próprio preparador não pode decidir a fonte" })).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: gestorId } });
  expect(await decidirDisponibilidadeOferta({ propostaId: primeira.dado.id, aprovada: true, motivo: "Primeira conferência independente", evidenciaTexto: "Gestão confirmou o primeiro recorte" })).toMatchObject({ ok: true });
  authMock.mockResolvedValue({ user: { id: secretariaId } });
  const segunda = await proporDisponibilidadeOferta(entrada("disponibilidade-2"));
  expect(segunda).toMatchObject({ ok: true, dado: { versao: 2 } });
  expect(await estado()).toMatchObject({ disponivel: false, consumivel: false });
});

it("faz a fonte negativa pendente prevalecer e não encerra o relato Q156", async () => {
  const proposta = await proporDisponibilidadeOferta(entrada());
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  expect(await registrarRelatoIndisponibilidadeOferta({ matriculaId, inicio: "2026-10-10", fim: "2026-10-12", motivo: "Oferta em conferência no meio do período", evidenciaTexto: "Relato negativo preservado para não liberar a provisão", chaveIdempotencia: "q156-negativo" })).toMatchObject({ ok: true });
  authMock.mockResolvedValue({ user: { id: gestorId } });
  expect(await decidirDisponibilidadeOferta({ propostaId: proposta.dado.id, aprovada: true, motivo: "Tentativa após relato negativo", evidenciaTexto: "A fonte negativa pendente precisa prevalecer" })).toMatchObject({ ok: false });
  expect(await prisma.registroIndisponibilidadeOfertaMatricula.count()).toBe(1);
});

it.each([
  { alteracao: { ativo: false }, descricao: "inativação" },
  { alteracao: { papeis: [Papel.SECRETARIA_ACADEMICA] }, descricao: "perda do papel de Gestão" },
])("recusa decisão após $descricao", async ({ alteracao }) => {
  const proposta = await proporDisponibilidadeOferta(entrada("revogacao-decisao"));
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  authMock.mockResolvedValue({ user: { id: gestorId } });
  await prisma.usuario.update({ where: { id: gestorId }, data: alteracao });
  await expect(decidirDisponibilidadeOferta({
    propostaId: proposta.dado.id, aprovada: true,
    motivo: "Decisão deve reler a autorização vigente", evidenciaTexto: "A permissão mudou antes da confirmação positiva",
  })).resolves.toMatchObject({ ok: false });
  expect(await prisma.decisaoDisponibilidadeOfertaMatricula.count()).toBe(0);
});

it("isola a aprovação por matrícula e preserva aprovação anterior em período disjunto", async () => {
  const primeira = await proporDisponibilidadeOferta(entrada("isolamento-outubro"));
  if (!primeira.ok || !primeira.dado) throw new Error(JSON.stringify(primeira));
  authMock.mockResolvedValue({ user: { id: gestorId } });
  expect(await decidirDisponibilidadeOferta({ propostaId: primeira.dado.id, aprovada: true, motivo: "Gestão confirma somente outubro desta matrícula", evidenciaTexto: "A fonte positiva pertence ao contrato e período identificados" })).toMatchObject({ ok: true });
  expect(await estado()).toMatchObject({ disponivel: true, consumivel: true });

  const original = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outra = await prisma.matricula.create({ data: { alunoId: original.alunoId, paisId: original.paisId, produtoId: original.produtoId, moeda: original.moeda } });
  await expect(prisma.$transaction((tx) => conferirDisponibilidadeOfertaTx(tx, { matriculaId: outra.id, inicio: "2026-10-01", fim: "2026-10-31" }))).resolves.toMatchObject({ disponivel: false, consumivel: false });

  authMock.mockResolvedValue({ user: { id: secretariaId } });
  const disjunta = await proporDisponibilidadeOferta({ ...entrada("isolamento-novembro"), inicio: "2026-11-01", fim: "2026-11-30" });
  if (!disjunta.ok || !disjunta.dado) throw new Error(JSON.stringify(disjunta));
  authMock.mockResolvedValue({ user: { id: gestorId } });
  expect(await decidirDisponibilidadeOferta({ propostaId: disjunta.dado.id, aprovada: true, motivo: "Gestão confirma novembro sem reabrir outubro", evidenciaTexto: "O novo recorte não substitui a evidência positiva anterior" })).toMatchObject({ ok: true });
  expect(await estado()).toMatchObject({ disponivel: true, consumivel: true });
});


