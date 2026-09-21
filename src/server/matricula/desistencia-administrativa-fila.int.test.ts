import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormaPagamento, Papel, TipoCobranca } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared")>();
  const sessao = async () => {
    const autenticacao = await authMock();
    const usuario = await prisma.usuario.findUnique({ where: { id: autenticacao.user.id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { consultarDesistenciaPreparacao, registrarPedidoDesistenciaPreparacao } from "./desistencia-preparacao";
import { decidirDesistenciaAdministrativa } from "./desistencia-administrativa";
import { listarPendenciasAdministrativasDesistencia } from "./desistencia-administrativa-fila";

let secretaria: Awaited<ReturnType<typeof criarUsuario>>;
let admin: typeof secretaria;
let vendedor: typeof secretaria;
let financeiro: typeof secretaria;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
let matriculaId: string;
let informeId: string;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const motivo = "Justificativa administrativa registrada com evidência suficiente.";
const evidencia = "Atendimento identificado no histórico da matrícula para a conferência.";

async function pedido(sufixo: string) {
  entrar(secretaria.id);
  const conferencia = await consultarDesistenciaPreparacao({ matriculaId });
  if (!conferencia.ok || !conferencia.dado) throw new Error("Conferência ausente.");
  const criado = await registrarPedidoDesistenciaPreparacao({ matriculaId, estadoHash: conferencia.dado.estadoHash, motivo, evidenciaPedido: evidencia,
    chaveIdempotencia: `fila-administrativa-${sufixo}` });
  if (!criado.ok || !criado.dado) throw new Error("Pedido ausente.");
  return { ...criado.dado, estadoHash: conferencia.dado.estadoHash };
}

async function criarItemFormal(sufixo: string) {
  const aluno = await prisma.aluno.create({ data: { primeiroNome: `Pessoa ${sufixo}`, paisId: catalogo.pais.id } });
  const id = (await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id,
    moeda: "CRC", status: "AGUARDANDO" } })).id;
  const cobranca = await prisma.cobranca.create({ data: { matriculaId: id, tipo: TipoCobranca.MATRICULA, valorOriginal: 100, valorNegociado: 100,
    saldo: 100, moeda: "CRC", vencimento: new Date("2026-10-15T12:00:00.000Z") } });
  await prisma.pagamentoInformado.create({ data: { cobrancaId: cobranca.id, autorId: secretaria.id, chaveIdempotencia: `fila-pagina-${sufixo}`,
    valor: 100, moeda: "CRC", forma: FormaPagamento.TRANSFERENCIA, dataPagamento: new Date("2026-10-10T12:00:00.000Z") } });
  const anterior = matriculaId;
  matriculaId = id;
  try { return await pedido(`pagina-${sufixo}`); } finally { matriculaId = anterior; }
}

beforeEach(async () => {
  await truncarBanco();
  catalogo = await seedCatalogoMinimo();
  [secretaria, admin, vendedor, financeiro] = await Promise.all([
    criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria"),
    criarUsuario([Papel.ADMINISTRADOR], "Administração"),
    criarUsuario([Papel.VENDEDOR], "Vendedor"),
    criarUsuario([Papel.FINANCEIRO], "Financeiro"),
  ]);
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Pessoa", paisId: catalogo.pais.id } });
  matriculaId = (await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id,
    moeda: "CRC", status: "AGUARDANDO" } })).id;
  const cobranca = await prisma.cobranca.create({ data: { matriculaId, tipo: TipoCobranca.MATRICULA, valorOriginal: 100, valorNegociado: 100,
    saldo: 100, moeda: "CRC", vencimento: new Date("2026-10-15T12:00:00.000Z") } });
  informeId = (await prisma.pagamentoInformado.create({ data: { cobrancaId: cobranca.id, autorId: secretaria.id, chaveIdempotencia: "fila-informe",
    valor: 100, moeda: "CRC", forma: FormaPagamento.TRANSFERENCIA, dataPagamento: new Date("2026-10-10T12:00:00.000Z") } })).id;
});

describe("fila administrativa de desistência", () => {
  it("mostra uma matrícula uma vez e não ressuscita pedido histórico quando o atual foi decidido", async () => {
    await pedido("antigo");
    const atual = await pedido("atual");
    entrar(admin.id);
    const antes = await listarPendenciasAdministrativasDesistencia();
    expect(antes.ok && antes.dado?.itens.map((i) => i.pedido.id)).toEqual([atual.id]);
    expect(antes.ok && antes.dado?.itens[0]).toMatchObject({ podeAprovar: true, exigeConferencia: false });
    expect((await decidirDesistenciaAdministrativa({ pedidoId: atual.id, estadoHash: atual.estadoHash, aprovada: false, motivo })).ok).toBe(true);
    const depois = await listarPendenciasAdministrativasDesistencia();
    expect(depois.ok && depois.dado?.itens).toEqual([]);
  });

  it("é leitura para Secretaria e não expõe fotografia financeira", async () => {
    const criado = await pedido("secretaria");
    entrar(secretaria.id);
    const fila = await listarPendenciasAdministrativasDesistencia();
    expect(fila).toMatchObject({ ok: true, dado: { itens: [{ pedido: { id: criado.id }, podeDecidir: false, podeAprovar: false }] } });
    expect(JSON.stringify(fila)).not.toMatch(/snapshotJson|comprovante|valorRecebido|recebimentos/);
  });

  it("nega vendedor, Financeiro e administrador inativo", async () => {
    await pedido("permissoes");
    entrar(vendedor.id);
    expect(await listarPendenciasAdministrativasDesistencia()).toMatchObject({ ok: false });
    entrar(financeiro.id);
    expect(await listarPendenciasAdministrativasDesistencia()).toMatchObject({ ok: false });
    await prisma.usuario.update({ where: { id: admin.id }, data: { ativo: false } });
    entrar(admin.id);
    expect(await listarPendenciasAdministrativasDesistencia()).toMatchObject({ ok: false });
  });

  it("mantém o pedido stale cuja fonte formal foi alterada depois da fotografia", async () => {
    const criado = await pedido("stale");
    await prisma.pagamentoInformado.update({ where: { id: informeId }, data: { status: "REJEITADO" } });
    entrar(admin.id);
    expect(await listarPendenciasAdministrativasDesistencia()).toMatchObject({ ok: true, dado: {
      itens: [{ pedido: { id: criado.id }, atual: false, podeAprovar: false, exigeConferencia: true }],
    } });
  });

  it("pagina vinte matrículas por id sem duplicá-las", async () => {
    const ids = [(await pedido("pagina-base")).id];
    for (let indice = 1; indice <= 20; indice += 1) ids.push((await criarItemFormal(String(indice))).id);
    entrar(admin.id);
    const primeira = await listarPendenciasAdministrativasDesistencia();
    if (!primeira.ok || !primeira.dado?.proximoCursor) throw new Error("Primeira página ausente.");
    const segunda = await listarPendenciasAdministrativasDesistencia({ cursor: primeira.dado.proximoCursor });
    if (!segunda.ok || !segunda.dado) throw new Error("Segunda página ausente.");
    const listados = [...primeira.dado.itens, ...segunda.dado.itens].map((item) => item.pedido.id);
    expect(primeira.dado.itens).toHaveLength(20);
    expect(segunda.dado.itens).toHaveLength(1);
    expect(new Set(listados)).toEqual(new Set(ids));
  });
});
