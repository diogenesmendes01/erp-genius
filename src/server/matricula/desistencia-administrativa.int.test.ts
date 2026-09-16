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
import { consultarDecisaoAdministrativaDesistencia, decidirDesistenciaAdministrativa } from "./desistencia-administrativa";

let secretaria: Awaited<ReturnType<typeof criarUsuario>>;
let admin: typeof secretaria;
let matriculaId: string;
let informeId: string;
const entrar = (usuarioId: string) => authMock.mockResolvedValue({ user: { id: usuarioId } });
const motivo = "Justificativa administrativa registrada com evidência suficiente.";
const evidencia = "Atendimento identificado no histórico da matrícula para a conferência.";

async function criarPedido(sufixo: string, registrador = secretaria) {
  entrar(registrador.id);
  const conferencia = await consultarDesistenciaPreparacao({ matriculaId });
  expect(conferencia.ok).toBe(true);
  if (!conferencia.ok || !conferencia.dado) throw new Error("Conferência ausente.");
  const pedido = await registrarPedidoDesistenciaPreparacao({ matriculaId, estadoHash: conferencia.dado.estadoHash, motivo, evidenciaPedido: evidencia,
    chaveIdempotencia: `decisao-administrativa-${sufixo}` });
  expect(pedido.ok, pedido.ok ? undefined : pedido.erro).toBe(true);
  if (!pedido.ok || !pedido.dado) throw new Error("Pedido ausente.");
  return { ...pedido.dado, estadoHash: conferencia.dado.estadoHash };
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  [secretaria, admin] = await Promise.all([
    criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria"),
    criarUsuario([Papel.ADMINISTRADOR], "Administração um"),
  ]);
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Pessoa", paisId: catalogo.pais.id } });
  matriculaId = (await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "AGUARDANDO" } })).id;
  // A fixture real de informe conserva o avanço formal: não há guard desativado
  // nem saldo fabricado para tornar a aprovação possível.
  const cobranca = await prisma.cobranca.create({ data: { matriculaId, tipo: TipoCobranca.MATRICULA, valorOriginal: 100, valorNegociado: 100,
    saldo: 100, moeda: "CRC", vencimento: new Date("2026-10-15T12:00:00.000Z") } });
  informeId = (await prisma.pagamentoInformado.create({ data: { cobrancaId: cobranca.id, autorId: secretaria.id, chaveIdempotencia: "informe-decisao-administrativa",
    valor: 100, moeda: "CRC", forma: FormaPagamento.TRANSFERENCIA, dataPagamento: new Date("2026-10-10T12:00:00.000Z") } })).id;
});

describe("decisão administrativa de desistência", () => {
  it("autoriza apenas administrador independente e não efetiva consequências", async () => {
    const pedido = await criarPedido("independente");
    entrar(admin.id);
    const antes = { efetivacoes: await prisma.efetivacaoPedidoDesistenciaPreparacao.count(), recebimentos: await prisma.recebimento.count(), processos: await prisma.processoAssinaturaContratual.count() };
    const resultado = await decidirDesistenciaAdministrativa({ pedidoId: pedido.id, estadoHash: pedido.estadoHash, aprovada: true, motivo });
    expect(resultado.ok, resultado.ok ? undefined : resultado.erro).toBe(true);
    expect(await prisma.efetivacaoPedidoDesistenciaPreparacao.count()).toBe(antes.efetivacoes);
    expect(await prisma.recebimento.count()).toBe(antes.recebimentos);
    expect(await prisma.processoAssinaturaContratual.count()).toBe(antes.processos);
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "AGUARDANDO", ativadaEm: null });
    expect(await prisma.cobranca.findFirstOrThrow({ where: { matriculaId } })).toMatchObject({ status: "PENDENTE" });
    const consulta = await consultarDecisaoAdministrativaDesistencia({ matriculaId });
    expect(consulta).toMatchObject({ ok: true, dado: { exigeAprovacaoAdministrativa: true, pedidos: [{ id: pedido.id, podeDecidir: false, decisao: { aprovada: true, decisorNome: "Administração um" } }] } });
  });

  it("nega Secretaria e a autoaprovação, inclusive para usuário com os dois papéis", async () => {
    const pedido = await criarPedido("permissao");
    entrar(secretaria.id);
    expect(await decidirDesistenciaAdministrativa({ pedidoId: pedido.id, estadoHash: pedido.estadoHash, aprovada: true, motivo })).toMatchObject({ ok: false });
    // Administração também pode registrar o pedido, mas não pode decidir o seu.
    entrar(admin.id);
    const conferencia = await consultarDesistenciaPreparacao({ matriculaId });
    if (!conferencia.ok || !conferencia.dado) throw new Error("Conferência ausente.");
    const proprio = await registrarPedidoDesistenciaPreparacao({ matriculaId, estadoHash: conferencia.dado.estadoHash, motivo, evidenciaPedido: evidencia,
      chaveIdempotencia: "decisao-administrativa-proprio" });
    expect(proprio.ok).toBe(true);
    if (!proprio.ok || !proprio.dado) throw new Error("Pedido próprio ausente.");
    expect(await decidirDesistenciaAdministrativa({ pedidoId: proprio.dado.id, estadoHash: conferencia.dado.estadoHash, aprovada: true, motivo })).toMatchObject({ ok: false });
  });

  it("recusa aprovação stale, permite rejeição histórica e faz replay idêntico", async () => {
    const antigo = await criarPedido("historico");
    const atual = await criarPedido("novo");
    await prisma.matricula.update({ where: { id: matriculaId }, data: { contratoOk: true } });
    entrar(admin.id);
    expect(await decidirDesistenciaAdministrativa({ pedidoId: atual.id, estadoHash: atual.estadoHash, aprovada: true, motivo })).toMatchObject({ ok: false });
    const rejeicao = await decidirDesistenciaAdministrativa({ pedidoId: antigo.id, estadoHash: antigo.estadoHash, aprovada: false, motivo });
    expect(rejeicao.ok, rejeicao.ok ? undefined : rejeicao.erro).toBe(true);
    const replay = await decidirDesistenciaAdministrativa({ pedidoId: antigo.id, estadoHash: antigo.estadoHash, aprovada: false, motivo });
    expect(replay).toEqual(rejeicao);
    expect(await decidirDesistenciaAdministrativa({ pedidoId: antigo.id, estadoHash: antigo.estadoHash, aprovada: false, motivo: `${motivo} diferente` })).toMatchObject({ ok: false });
  });

  it.each(["America/Sao_Paulo", "Asia/Tokyo"])("aprova fontes UTC sem depender do fuso da sessão %s", async (fuso) => {
    const pedido = await criarPedido("fuso");
    const resultado = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT set_config('TimeZone', ${fuso}, true)`;
      const decisao = await tx.decisaoAdministrativaDesistencia.create({ data: {
        pedidoId: pedido.id, decisorId: admin.id, aprovada: true, motivo, estadoHash: pedido.estadoHash,
      } });
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      const configuracao = await tx.$queryRaw<Array<{ fuso: string }>>`SELECT current_setting('TimeZone') AS fuso`;
      return { decisao, configuracao };
    });
    expect(resultado.decisao.aprovada).toBe(true);
    expect(resultado.configuracao[0].fuso).toBe(fuso);
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "AGUARDANDO" });
  });

  it("não cria aprovação administrativa de avanço formal para o ramo sem avanço", async () => {
    await prisma.pagamentoInformado.updateMany({ data: { status: "REJEITADO" } });
    const pedido = await criarPedido("sem-avanco");
    entrar(admin.id);
    expect(await consultarDecisaoAdministrativaDesistencia({ matriculaId })).toMatchObject({ ok: true, dado: {
      exigeAprovacaoAdministrativa: false, pedidos: [{ id: pedido.id, podeAprovar: false }],
    } });
    expect((await decidirDesistenciaAdministrativa({ pedidoId: pedido.id, estadoHash: pedido.estadoHash, aprovada: true, motivo })).ok).toBe(false);
    await expect(prisma.decisaoAdministrativaDesistencia.create({ data: {
      pedidoId: pedido.id, decisorId: admin.id, aprovada: true, motivo, estadoHash: pedido.estadoHash,
    } })).rejects.toThrow(/avanço formal/i);
  });

  it("mostra a Secretaria somente leitura e revalida a alçada administrativa antes da decisão", async () => {
    const pedido = await criarPedido("alcada-atual");
    entrar(secretaria.id);
    const consulta = await consultarDecisaoAdministrativaDesistencia({ matriculaId });
    expect(consulta).toMatchObject({ ok: true, dado: { pedidos: [{ id: pedido.id, podeDecidir: false, podeAprovar: false }] } });
    if (!consulta.ok || !consulta.dado) throw new Error("Consulta ausente.");
    expect(consulta.dado).not.toHaveProperty("cobrancas");
    expect(consulta.dado.pedidos[0]).not.toHaveProperty("snapshotJson");
    entrar(admin.id);
    await prisma.usuario.update({ where: { id: admin.id }, data: { papeis: [Papel.SECRETARIA_ACADEMICA] } });
    expect((await decidirDesistenciaAdministrativa({ pedidoId: pedido.id, estadoHash: pedido.estadoHash, aprovada: true, motivo })).ok).toBe(false);
    await expect(prisma.decisaoAdministrativaDesistencia.create({ data: {
      pedidoId: pedido.id, decisorId: admin.id, aprovada: true, motivo, estadoHash: pedido.estadoHash,
    } })).rejects.toThrow(/administrador|administração/i);
    expect(await prisma.decisaoAdministrativaDesistencia.count()).toBe(0);
  });

  it("confere a fonte documental com caracteres especiais e recusa alteração posterior", async () => {
    const documento = await prisma.documento.create({ data: { matriculaId, categoria: "CONTRATO", nome: 'Contrato “aluno” com "aspas"', url: '/api/files/teste-ç.pdf' } });
    const pedido = await criarPedido("documento");
    entrar(admin.id);
    const decisao = await decidirDesistenciaAdministrativa({ pedidoId: pedido.id, estadoHash: pedido.estadoHash, aprovada: true, motivo });
    expect(decisao.ok, decisao.ok ? undefined : decisao.erro).toBe(true);
    const proximo = await criarPedido("documento-seguinte");
    await prisma.documento.update({ where: { id: documento.id }, data: { url: "/api/files/outro.pdf" } });
    await expect(prisma.decisaoAdministrativaDesistencia.create({ data: {
      pedidoId: proximo.id, decisorId: admin.id, aprovada: true, motivo, estadoHash: proximo.estadoHash,
    } })).rejects.toThrow(/documental|conferência|mudou/i);
    expect(await prisma.decisaoAdministrativaDesistencia.count()).toBe(1);
  });

  it("mantém as barreiras SQL contra alçada, fotografia stale e alteração da decisão", async () => {
    const pedido = await criarPedido("sql-secretaria");
    const dados = { pedidoId: pedido.id, aprovada: true, motivo, estadoHash: pedido.estadoHash };
    await expect(prisma.decisaoAdministrativaDesistencia.create({ data: { ...dados, decisorId: secretaria.id } })).rejects.toThrow();

    const proprio = await criarPedido("sql-proprio", admin);
    await expect(prisma.decisaoAdministrativaDesistencia.create({ data: { pedidoId: proprio.id, aprovada: true, motivo, estadoHash: proprio.estadoHash, decisorId: admin.id } })).rejects.toThrow();

    const stale = await criarPedido("sql-stale");
    const versaoAntes = (await prisma.cobranca.findFirstOrThrow({ where: { matriculaId }, select: { versao: true } })).versao;
    await prisma.pagamentoInformado.update({ where: { id: informeId }, data: { status: "CONFIRMADO", conferenteId: admin.id, motivoConferencia: "Informe confirmado após nova evidência." } });
    expect((await prisma.cobranca.findFirstOrThrow({ where: { matriculaId }, select: { versao: true } })).versao).toBe(versaoAntes);
    await expect(prisma.decisaoAdministrativaDesistencia.create({ data: { pedidoId: stale.id, aprovada: true, motivo, estadoHash: stale.estadoHash, decisorId: admin.id } })).rejects.toThrow();

    // Uma decisão aprovada válida passa pelo trigger e depois não pode mudar
    // ou ser apagada por acesso direto ao banco.
    const novo = await criarPedido("sql-imutavel");
    const decisao = await prisma.decisaoAdministrativaDesistencia.create({ data: { pedidoId: novo.id, aprovada: true, motivo, estadoHash: novo.estadoHash, decisorId: admin.id } });
    await expect(prisma.decisaoAdministrativaDesistencia.update({ where: { id: decisao.id }, data: { motivo: "Motivo alterado indevidamente." } })).rejects.toThrow();
    await expect(prisma.decisaoAdministrativaDesistencia.delete({ where: { id: decisao.id } })).rejects.toThrow();
  });
});
