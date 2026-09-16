import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { registrarRelatoIndisponibilidadeOferta } from "./indisponibilidade-oferta-relato";
import { confirmarRelatoIndisponibilidadeOferta } from "./indisponibilidade-oferta-confirmacao";
import { proporTerminoIndisponibilidadeOferta, decidirTerminoIndisponibilidadeOferta, consultarTerminosIndisponibilidadeOferta } from "./indisponibilidade-oferta-termino";
import { conferirIndisponibilidadeOfertaTx } from "./indisponibilidade-oferta-estado";
import * as sessao from "@/server/_shared/sessao";

let matriculaId: string, registroId: string, secretariaId: string, gestorId: string;
const proposta = () => ({ registroId, fim: "2026-10-10", motivo: "Oferta regularizada pela escola", evidenciaTexto: "Gestão conferiu a disponibilidade de continuidade", chaveIdempotencia: "termino-oferta-primeira" });
const decidir = (propostaId: string, aprovada = true) => decidirTerminoIndisponibilidadeOferta({ propostaId, aprovada, motivo: "Conferência independente do término", evidenciaTexto: "Oferta e data final conferidas pela gestão" });
const estado = (dia: string) => prisma.$transaction(tx => conferirIndisponibilidadeOfertaTx(tx, { matriculaId, inicio: new Date(dia), fim: new Date(dia) }));
beforeEach(async () => {
  await truncarBanco();
  const c = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Término", paisId: c.pais.id } });
  matriculaId = (await prisma.matricula.create({ data: { alunoId: aluno.id, paisId: c.pais.id, produtoId: c.produto.id, moeda: "CRC" } })).id;
  authMock.mockResolvedValue({ user: { id: secretariaId } });
  const relato = await registrarRelatoIndisponibilidadeOferta({ matriculaId, inicio: "2026-10-01", fim: null, motivo: "Escola sem turma disponível", evidenciaTexto: "Indisponibilidade registrada para continuidade", chaveIdempotencia: "relato-para-termino" });
  if (!relato.ok || !relato.dado) throw new Error(JSON.stringify(relato));
  registroId = relato.dado.id;
  authMock.mockResolvedValue({ user: { id: gestorId } });
  expect(await confirmarRelatoIndisponibilidadeOferta({ registroId, confirmada: true, motivo: "Falta de oferta confirmada", evidenciaTexto: "Gestão conferiu a inexistência de turma" })).toMatchObject({ ok: true });
  authMock.mockResolvedValue({ user: { id: secretariaId } });
});

it("aprova término independente, limita o intervalo e preserva contrato e cobranças", async () => {
  const antes = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const p = await proporTerminoIndisponibilidadeOferta(proposta());
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  expect(await proporTerminoIndisponibilidadeOferta(proposta())).toEqual(p);
  expect(await estado("2026-10-11")).toMatchObject({ estado: "INDISPONIVEL" });
  authMock.mockResolvedValue({ user: { id: gestorId } });
  const d = await decidir(p.dado.id);
  expect(d).toMatchObject({ ok: true });
  expect(await decidir(p.dado.id)).toEqual(d);
  expect(await estado("2026-10-10")).toMatchObject({ estado: "INDISPONIVEL", registros: [{ fim: "2026-10-10" }] });
  expect(await estado("2026-10-11")).toMatchObject({ estado: "SEM_RELATO", registros: [] });
  expect(await prisma.registroIndisponibilidadeOfertaMatricula.findUnique({ where: { id: registroId } })).toMatchObject({ fim: null });
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toEqual(antes);
  expect(await prisma.cobranca.count()).toBe(0);
  await expect(prisma.propostaTerminoIndisponibilidadeOferta.update({ where: { id: p.dado.id }, data: { fim: new Date("2026-10-09") } })).rejects.toThrow();
  await expect(prisma.decisaoTerminoIndisponibilidadeOferta.deleteMany()).rejects.toThrow();
  expect(await decidir(p.dado.id, false)).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: secretariaId } });
  expect(await proporTerminoIndisponibilidadeOferta({ ...proposta(), chaveIdempotencia: "outro-termino-aprovado" })).toMatchObject({ ok: false });
});

it("nega autoaprovação com acúmulo de papéis e permite nova proposta após rejeição", async () => {
  const p = await proporTerminoIndisponibilidadeOferta(proposta());
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  await prisma.usuario.update({ where: { id: secretariaId }, data: { papeis: ["SECRETARIA_ACADEMICA", "ADMINISTRADOR"] } });
  expect(await decidir(p.dado.id)).toMatchObject({ ok: false });
  await expect(prisma.decisaoTerminoIndisponibilidadeOferta.create({ data: { propostaId: p.dado.id, decisorId: secretariaId, aprovada: true, motivo: "Tentativa do próprio preparador", evidenciaTexto: "Evidência de teste para autoaprovação", entradaHash: "a".repeat(64) } })).rejects.toThrow();
  expect(await proporTerminoIndisponibilidadeOferta({ ...proposta(), chaveIdempotencia: "segunda-pendente-bloqueada" })).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: gestorId } });
  expect(await decidir(p.dado.id, false)).toMatchObject({ ok: true });
  expect(await estado("2026-10-11")).toMatchObject({ estado: "INDISPONIVEL" });
  authMock.mockResolvedValue({ user: { id: secretariaId } });
  expect(await proporTerminoIndisponibilidadeOferta({ ...proposta(), chaveIdempotencia: "segunda-apos-rejeicao", fim: "2026-10-12" })).toMatchObject({ ok: true });
});

it("Financeiro consulta sem propor ou decidir; revogação impede decisão", async () => {
  const p = await proporTerminoIndisponibilidadeOferta(proposta());
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  authMock.mockResolvedValue({ user: { id: (await criarUsuario(["FINANCEIRO"])).id } });
  expect(await consultarTerminosIndisponibilidadeOferta({ registroId })).toMatchObject({ ok: true, dado: { podePropor: false, propostas: [{ podeDecidir: false }] } });
  expect(await proporTerminoIndisponibilidadeOferta(proposta())).toMatchObject({ ok: false });
  expect(await decidir(p.dado.id)).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: gestorId } });
  await prisma.usuario.update({ where: { id: gestorId }, data: { ativo: false } });
  expect(await decidir(p.dado.id)).toMatchObject({ ok: false });
  expect(await prisma.decisaoTerminoIndisponibilidadeOferta.count()).toBe(0);
});

it("recusa intervalo anterior, chave divergente e relato já fechado ou não confirmado", async () => {
  expect(await proporTerminoIndisponibilidadeOferta({ ...proposta(), fim: "2026-09-30" })).toMatchObject({ ok: false });
  expect(await proporTerminoIndisponibilidadeOferta(proposta())).toMatchObject({ ok: true });
  expect(await proporTerminoIndisponibilidadeOferta({ ...proposta(), fim: "2026-10-11" })).toMatchObject({ ok: false });
  const fechado = await registrarRelatoIndisponibilidadeOferta({ matriculaId, inicio: "2026-10-01", fim: "2026-10-05", motivo: "Relato com intervalo delimitado", evidenciaTexto: "Intervalo já tem data final conhecida", chaveIdempotencia: "relato-fechado-termino" });
  if (!fechado.ok || !fechado.dado) throw new Error(JSON.stringify(fechado));
  expect(await proporTerminoIndisponibilidadeOferta({ ...proposta(), registroId: fechado.dado.id, chaveIdempotencia: "terminar-nao-confirmado" })).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: gestorId } });
  expect(await confirmarRelatoIndisponibilidadeOferta({ registroId: fechado.dado.id, confirmada: true, motivo: "Intervalo delimitado confirmado", evidenciaTexto: "Confirmada indisponibilidade no intervalo" })).toMatchObject({ ok: true });
  authMock.mockResolvedValue({ user: { id: secretariaId } });
  expect(await proporTerminoIndisponibilidadeOferta({ ...proposta(), registroId: fechado.dado.id, chaveIdempotencia: "terminar-ja-fechado" })).toMatchObject({ ok: false });
});

it("serializa proposta e decisão simultâneas, preservando um único término", async () => {
  // Fixar a sessão evita a corrida do mock de import dinâmico de NextAuth;
  // a conferência fresca de ator e todas as transações continuam reais.
  const autenticacao = vi.spyOn(sessao, "exigirSessaoComPapel").mockResolvedValue({ id: secretariaId, nome: "Secretaria", papeis: ["SECRETARIA_ACADEMICA"] });
  try {
    const [p, repetida] = await Promise.all([proporTerminoIndisponibilidadeOferta(proposta()), proporTerminoIndisponibilidadeOferta(proposta())]);
    if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
    expect(repetida).toEqual(p);
    autenticacao.mockResolvedValue({ id: gestorId, nome: "Gestão", papeis: ["GERENTE_PEDAGOGICO"] });
    const [d, replay] = await Promise.all([decidir(p.dado.id), decidir(p.dado.id)]);
    expect(d).toMatchObject({ ok: true });
    expect(replay).toEqual(d);
    expect(await prisma.propostaTerminoIndisponibilidadeOferta.count()).toBe(1);
    expect(await prisma.decisaoTerminoIndisponibilidadeOferta.count()).toBe(1);
    expect(await prisma.evento.count({ where: { agregadoId: matriculaId, tipo: "TerminoIndisponibilidadeOfertaDecidido" } })).toBe(1);
  } finally {
    autenticacao.mockRestore();
  }
});

it("terminar um relato não oculta outra indisponibilidade sobreposta ou sua pendência", async () => {
  const p = await proporTerminoIndisponibilidadeOferta(proposta());
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  const outro = await registrarRelatoIndisponibilidadeOferta({ matriculaId, inicio: "2026-10-09", fim: "2026-10-20", motivo: "Outra indisponibilidade sobreposta", evidenciaTexto: "Outro impedimento de oferta ainda precisa de conferência", chaveIdempotencia: "relato-sobreposto-independente" });
  if (!outro.ok || !outro.dado) throw new Error(JSON.stringify(outro));
  authMock.mockResolvedValue({ user: { id: gestorId } });
  expect(await decidir(p.dado.id)).toMatchObject({ ok: true });
  expect(await estado("2026-10-11")).toMatchObject({ estado: "PENDENTE_CONFERENCIA", registros: [] });
  expect(await confirmarRelatoIndisponibilidadeOferta({ registroId: outro.dado.id, confirmada: true, motivo: "Segundo impedimento confirmado", evidenciaTexto: "A gestão confirmou o impedimento até dia vinte" })).toMatchObject({ ok: true });
  const sobreposto = await estado("2026-10-11");
  expect(sobreposto.estado).toBe("INDISPONIVEL");
  expect(sobreposto.registros).toHaveLength(1);
  expect(sobreposto.registros[0]).toMatchObject({ id: outro.dado.id, fim: "2026-10-20" });
  expect(await estado("2026-10-21")).toMatchObject({ estado: "SEM_RELATO", registros: [] });
});
