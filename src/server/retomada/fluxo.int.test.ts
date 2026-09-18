import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, StatusCobranca, TipoAjuste, TipoCobranca, Vigencia, type Cobranca } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import type { Resultado } from "@/server/_shared";
import { pausarAluno, reativarAluno } from "@/server/alunos/acoes";
import { registrarPagamento } from "@/server/financeiro/acoes";
import { ajustarCobranca } from "@/server/ajustes/acoes";
import { rodarControleAcessoAulas } from "@/server/cobrancas/acesso-aulas";
import { ativarMatricula, concluirMatricula } from "@/server/matricula/acoes";
import { decidirRetomada, solicitarRetomada } from "./acoes";
import { listarContextoRetomada, listarPropostasRetomada } from "./consultas";
import type { SolicitarRetomadaInput } from "./schema";

type Usuario = Awaited<ReturnType<typeof criarUsuario>>;
let sec: Usuario;
let fin: Usuario;
let adm: Usuario;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
let alunoId: string;
let matriculaId: string;
let parcelas: Record<"atrasada" | "parcial" | "futura" | "paga" | "taxa" | "manual" | "pendenteVencida", Cobranca>;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const motivo = "Retorno acordado com aluno e financeiro";
const dataEm = (dias: number) => {
  const data = new Date();
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias, 12);
};
const diaEm = (dias: number) => {
  const data = dataEm(dias);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
};
const manter: SolicitarRetomadaInput = { opcao: "MANTER_VENCIMENTOS", motivo };

it("mantém proposta antiga consultável e rejeitável quando outro contrato impede retomada global", async () => {
  await pausar();
  const id = await propor();
  const outra = await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
  const antes = { aluno: await aluno(), calendario: await calendario(), recebimentos: await recebimentos() };
  const contexto = sucesso(await listarContextoRetomada(alunoId));
  expect(contexto.impedimento).toContain("selecione os contratos");
  expect(contexto.parcelas).toEqual([]);
  entrar(fin.id);
  const proposta = sucesso(await listarPropostasRetomada(alunoId)).find(p => p.id === id)!;
  expect(proposta.podeDecidir).toBe(true);
  expect(proposta.impedimentoAprovacao).toContain("selecione os contratos");
  expect((await decidirRetomada(id, { aprovar: true, motivo })).ok).toBe(false);
  sucesso(await decidirRetomada(id, { aprovar: false, motivo: "Preparar retomada específica por matrícula" }));
  expect((await prisma.propostaRetomada.findUniqueOrThrow({ where: { id } })).status).toBe("REJEITADA");
  expect({ aluno: await aluno(), calendario: await calendario(), recebimentos: await recebimentos() }).toEqual(antes);
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: outra.id } })).toEqual(outra);
});

function sucesso<T>(resultado: Resultado<T>) {
  expect(resultado.ok, resultado.ok ? undefined : resultado.erro).toBe(true);
  if (!resultado.ok) throw new Error(resultado.erro);
  return resultado.dado!;
}

const aluno = () => prisma.aluno.findUniqueOrThrow({ where: { id: alunoId } });
const matricula = () => prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
const calendario = () => prisma.cobranca.findMany({ where: { matriculaId }, orderBy: { id: "asc" } });
const movimentosRetomada = () => prisma.movimentacaoAluno.findMany({ where: { alunoId, tipo: "REATIVACAO" } });
const recebimentos = () => prisma.recebimento.findMany({ where: { titularMatriculaId: matriculaId }, orderBy: { id: "asc" } });

function memoriaDaDivida(cobrancas: Cobranca[]) {
  return cobrancas.map((c) => ({
    id: c.id, codigo: c.codigo, matriculaId: c.matriculaId, tipo: c.tipo, competencia: c.competencia,
    valorOriginal: c.valorOriginal.toFixed(2), valorNegociado: c.valorNegociado.toFixed(2),
    valorRecebido: c.valorRecebido?.toFixed(2) ?? null, saldo: c.saldo?.toFixed(2) ?? null, moeda: c.moeda,
    pagoEm: c.pagoEm, formaPagamento: c.formaPagamento, comprovanteUrl: c.comprovanteUrl,
    comprovanteNome: c.comprovanteNome, comentario: c.comentario, criadoEm: c.criadoEm,
  }));
}

async function criarCobranca(idMatricula: string, dias: number, valor: number, extra: { tipo?: TipoCobranca; status?: StatusCobranca } = {}) {
  return prisma.cobranca.create({ data: {
    matriculaId: idMatricula, tipo: extra.tipo ?? "MENSALIDADE", status: extra.status ?? "PENDENTE",
    moeda: "CRC", competencia: diaEm(dias).slice(0, 7), vencimento: dataEm(dias),
    valorOriginal: valor, valorNegociado: valor, valorRecebido: 0, saldo: valor,
  } });
}

async function pagar(cobrancaId: string, valor: number) {
  entrar(fin.id);
  sucesso(await registrarPagamento(cobrancaId, { chaveIdempotencia: randomUUID(), valorRecebido: valor, forma: "DINHEIRO", comentario: "Recebimento conferido e destinado à mensalidade identificada" }));
}

async function pausar() {
  entrar(sec.id);
  sucesso(await pausarAluno(alunoId, { motivo: "Pausa a pedido do aluno" }));
  return prisma.movimentacaoAluno.findFirstOrThrow({ where: { alunoId, tipo: "PAUSA" }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }] });
}

async function propor(input: SolicitarRetomadaInput = manter, autorId = sec.id) {
  entrar(autorId);
  return sucesso(await solicitarRetomada(alunoId, input)).propostaId;
}

async function reprogramacao(): Promise<SolicitarRetomadaInput> {
  entrar(sec.id);
  const contexto = sucesso(await listarContextoRetomada(alunoId));
  return { opcao: "REPROGRAMAR_PARCELAS", motivo, novosVencimentos: contexto.parcelas.map((p, i) => ({ cobrancaId: p.cobrancaId, vencimento: diaEm(20 + i * 30) })) };
}

function sinal() {
  let liberar!: () => void;
  const promessa = new Promise<void>((resolve) => { liberar = resolve; });
  return { promessa, liberar };
}

beforeEach(async () => {
  await truncarBanco();
  sec = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  fin = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  adm = await criarUsuario([Papel.ADMINISTRADOR], "Administração");
  await prisma.usuario.update({ where: { id: fin.id }, data: { limiteDescontoMensalidadePct: 100 } });
  catalogo = await seedCatalogoMinimo();
  const pessoa = await prisma.aluno.create({ data: {
    primeiroNome: "Pessoa", sobrenome: "Retomada", paisId: catalogo.pais.id, status: "ATIVO",
    documento: "documento-privado-retomada", email: "privado-retomada@example.test", observacoes: "Observação pessoal reservada",
  } });
  alunoId = pessoa.id;
  const m = await prisma.matricula.create({ data: {
    alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", mesesPlano: 6,
  } });
  matriculaId = m.id;
  parcelas = {
    atrasada: await criarCobranca(m.id, -40, 100, { status: "ATRASADO" }),
    parcial: await criarCobranca(m.id, 10, 200),
    futura: await criarCobranca(m.id, 40, 300),
    paga: await criarCobranca(m.id, 70, 150),
    taxa: await criarCobranca(m.id, 20, 500, { tipo: "MATRICULA" }),
    manual: await criarCobranca(m.id, 5, 120, { status: "CANCELADA" }),
    pendenteVencida: await criarCobranca(m.id, -2, 80),
  };
  await pagar(parcelas.parcial.id, 50);
  await pagar(parcelas.paga.id, 150);
  expect(await recebimentos()).toHaveLength(2);
  entrar(sec.id);
});

describe("pausa e retomada sem recriar a dívida", () => {
  it("pausa cancela só mensalidades futuras pendentes, registra a origem e preserva taxas, pagamentos e cancelamento manual", async () => {
    const antes = await calendario();
    const ledger = await recebimentos();
    const pausa = await pausar();
    const depois = await calendario();
    expect((await aluno()).status).toBe("PAUSADO");
    expect((await matricula()).status).toBe("ATIVA");
    expect(memoriaDaDivida(depois)).toEqual(memoriaDaDivida(antes));
    expect(await recebimentos()).toEqual(ledger);
    const canceladasPelaPausa = new Set([parcelas.parcial.id, parcelas.futura.id]);
    for (const c of depois) {
      const anterior = antes.find((p) => p.id === c.id)!;
      if (canceladasPelaPausa.has(c.id)) {
        expect(c).toMatchObject({ status: "CANCELADA", canceladaPorPausaId: pausa.id, versao: anterior.versao + 1 });
        expect(c.vencimento).toEqual(anterior.vencimento);
      } else expect(c).toEqual(anterior);
    }
    expect(await eventosDo("Aluno", alunoId)).toEqual(expect.arrayContaining([expect.objectContaining({
      tipo: "AlunoPausado", autorId: sec.id, payload: expect.objectContaining({ pausaId: pausa.id, protocoloRetomada: 1 }),
    })]));
  });

  it("reativarAluno legado não contorna a proposta, mesmo por administrador", async () => {
    await pausar();
    const antes = await calendario();
    for (const usuario of [sec, adm]) {
      entrar(usuario.id);
      expect((await reativarAluno(alunoId)).ok).toBe(false);
    }
    expect((await aluno()).status).toBe("PAUSADO");
    expect(await calendario()).toEqual(antes);
    expect(await movimentosRetomada()).toHaveLength(0);
  });

  it.each([Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO, Papel.ADMINISTRADOR])("%s propõe sem alterar aluno, calendário ou recebimentos", async (papel) => {
    const pausa = await pausar();
    const solicitante = await criarUsuario([papel]);
    const antes = await calendario();
    const ledger = await recebimentos();
    const propostaId = await propor(await reprogramacao(), solicitante.id);
    expect(await prisma.propostaRetomada.findUniqueOrThrow({ where: { id: propostaId } })).toMatchObject({
      alunoId, pausaId: pausa.id, solicitanteId: solicitante.id, status: "PENDENTE", aprovadorId: null, decididoEm: null, motivoDecisao: null,
    });
    expect((await aluno()).status).toBe("PAUSADO");
    expect(await calendario()).toEqual(antes);
    expect(await recebimentos()).toEqual(ledger);
    expect(await movimentosRetomada()).toHaveLength(0);
  });

  it("MANTER reabre só parcelas da pausa atual, com vencimentos e memória financeira originais", async () => {
    const pausa = await pausar();
    const antes = await calendario();
    const ledger = await recebimentos();
    const historico = await prisma.evento.findMany({ where: { agregadoTipo: "Cobranca", agregadoId: { in: antes.map((p) => p.id) } } });
    const propostaId = await propor();
    entrar(fin.id);
    sucesso(await decidirRetomada(propostaId, { aprovar: true, motivo: "Calendário original conferido" }));
    const depois = await calendario();
    expect((await aluno()).status).toBe("ATIVO");
    expect(memoriaDaDivida(depois)).toEqual(memoriaDaDivida(antes));
    expect(depois.map((p) => p.vencimento)).toEqual(antes.map((p) => p.vencimento));
    expect(depois.map((p) => p.cicloRegua)).toEqual(antes.map((p) => p.cicloRegua));
    expect(await recebimentos()).toEqual(ledger);
    for (const c of depois) {
      const anterior = antes.find((p) => p.id === c.id)!;
      if (anterior.canceladaPorPausaId === pausa.id) {
        expect(c.status).toBe("PENDENTE");
        expect(c.versao).toBe(anterior.versao + 1);
      } else expect(c).toEqual(anterior);
    }
    expect(await prisma.evento.findMany({ where: { id: { in: historico.map((e) => e.id) } } })).toEqual(expect.arrayContaining(historico));
    expect(await movimentosRetomada()).toEqual([expect.objectContaining({ usuarioId: fin.id, statusOrigem: "PAUSADO", statusDestino: "ATIVO" })]);
    expect(await prisma.propostaRetomada.findUnique({ where: { id: propostaId } })).toMatchObject({ status: "APROVADA", aprovadorId: fin.id, motivoDecisao: "Calendário original conferido", decididoEm: expect.any(Date) });
  });

  it("REPROGRAMAR aplica novas datas aos remanescentes mantendo IDs, saldo parcial, recebimentos e histórico", async () => {
    await pausar();
    const input = await reprogramacao();
    // Restaurar uma parcela sem mudar sua data não inicia outro ciclo de mensagens.
    input.novosVencimentos!.find((p) => p.cobrancaId === parcelas.parcial.id)!.vencimento = diaEm(10);
    expect(input.novosVencimentos).toHaveLength(4);
    const antes = await calendario();
    const ledger = await recebimentos();
    const propostaId = await propor(input);
    entrar(adm.id);
    sucesso(await decidirRetomada(propostaId, { aprovar: true, motivo: "Reprogramação financeira aprovada" }));
    const depois = await calendario();
    expect(memoriaDaDivida(depois)).toEqual(memoriaDaDivida(antes));
    expect(await recebimentos()).toEqual(ledger);
    for (const c of depois) {
      const nova = input.novosVencimentos!.find((p) => p.cobrancaId === c.id);
      const anterior = antes.find((p) => p.id === c.id)!;
      if (nova) {
        expect(c.vencimento.toISOString().slice(0, 10)).toBe(nova.vencimento);
        expect(c.status).toBe("PENDENTE");
        expect(c.versao).toBe(anterior.versao + 1);
        const mudouData = nova.vencimento !== anterior.vencimento.toISOString().slice(0, 10);
        expect(c.cicloRegua).toBe(anterior.cicloRegua + Number(mudouData));
      } else expect(c).toEqual(anterior);
    }
    expect(depois.find((c) => c.id === parcelas.parcial.id)!.saldo!.toFixed(2)).toBe("150.00");
    expect(await movimentosRetomada()).toHaveLength(1);
  });

  it("rejeição preserva pausa e calendário, audita outra pessoa e permite uma nova proposta", async () => {
    await pausar();
    const antes = await calendario();
    const propostaId = await propor(await reprogramacao());
    entrar(fin.id);
    sucesso(await decidirRetomada(propostaId, { aprovar: false, motivo: "Datas precisam ser negociadas novamente" }));
    expect(await prisma.propostaRetomada.findUnique({ where: { id: propostaId } })).toMatchObject({
      status: "REJEITADA", aprovadorId: fin.id, motivoDecisao: "Datas precisam ser negociadas novamente", decididoEm: expect.any(Date),
    });
    expect((await aluno()).status).toBe("PAUSADO");
    expect(await calendario()).toEqual(antes);
    expect(await movimentosRetomada()).toHaveLength(0);
    const nova = await propor();
    expect(nova).not.toBe(propostaId);
    expect(await prisma.propostaRetomada.count({ where: { alunoId } })).toBe(2);
  });
});

describe("alçadas, revogação e projeções da retomada", () => {
  it.each([Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.GERENTE_PEDAGOGICO, Papel.PROFESSOR])("%s não propõe nem consulta o conteúdo financeiro por chamada direta", async (papel) => {
    await pausar();
    const usuario = await criarUsuario([papel]); entrar(usuario.id);
    expect((await solicitarRetomada(alunoId, manter)).ok).toBe(false);
    expect((await listarContextoRetomada(alunoId)).ok).toBe(false);
    expect((await listarPropostasRetomada(alunoId)).ok).toBe(false);
    expect((await listarPropostasRetomada()).ok).toBe(false);
    expect(await prisma.propostaRetomada.count()).toBe(0);
  });

  it.each([{ papeis: [Papel.ADMINISTRADOR] }, { papeis: [Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO] }])("solicitante $papeis não aprova nem rejeita a própria proposta", async ({ papeis }) => {
    await pausar();
    const usuario = await criarUsuario(papeis);
    const propostaId = await propor(manter, usuario.id);
    expect(sucesso(await listarPropostasRetomada(alunoId))[0].podeDecidir).toBe(false);
    for (const aprovar of [true, false]) expect((await decidirRetomada(propostaId, { aprovar, motivo: "Decisão do próprio solicitante" })).ok).toBe(false);
    expect((await prisma.propostaRetomada.findUniqueOrThrow({ where: { id: propostaId } })).status).toBe("PENDENTE");
    expect((await aluno()).status).toBe("PAUSADO");
    expect(await movimentosRetomada()).toHaveLength(0);
  });

  it("secretaria consulta a ficha individual, mas não decide nem recebe fila global ou snapshot bruto", async () => {
    await pausar();
    const propostaId = await propor();
    const outraSec = await criarUsuario([Papel.SECRETARIA_ACADEMICA]); entrar(outraSec.id);
    const contexto = sucesso(await listarContextoRetomada(alunoId));
    const propostas = sucesso(await listarPropostasRetomada(alunoId));
    expect(contexto.propostaPendenteId).toBe(propostaId);
    expect(contexto.parcelas).toHaveLength(4);
    expect(propostas).toEqual([expect.objectContaining({ id: propostaId, podeDecidir: false })]);
    expect((await listarPropostasRetomada()).ok).toBe(false);
    expect((await decidirRetomada(propostaId, { aprovar: true, motivo })).ok).toBe(false);
    for (const retorno of [contexto, propostas]) {
      const json = JSON.stringify(retorno);
      for (const campo of ["snapshot", "documento-privado-retomada", "privado-retomada@example.test", "Observação pessoal reservada", "senhaHash"]) expect(json).not.toContain(campo);
    }
    entrar(fin.id);
    expect(sucesso(await listarPropostasRetomada())).toEqual([expect.objectContaining({ id: propostaId, podeDecidir: true })]);
    entrar(adm.id);
    expect(sucesso(await listarPropostasRetomada())).toEqual([expect.objectContaining({ id: propostaId, podeDecidir: true })]);
  });

  it.each(["papel revogado", "pessoa desativada"])("revalida a sessão para propor e decidir com %s", async (caso) => {
    await pausar();
    const propostaId = await propor();
    entrar(fin.id);
    await prisma.usuario.update({ where: { id: fin.id }, data: caso === "papel revogado" ? { papeis: [Papel.VENDEDOR] } : { ativo: false } });
    expect((await decidirRetomada(propostaId, { aprovar: true, motivo })).ok).toBe(false);
    expect((await listarPropostasRetomada()).ok).toBe(false);
    expect((await listarContextoRetomada(alunoId)).ok).toBe(false);
    entrar(sec.id);
    await prisma.usuario.update({ where: { id: sec.id }, data: caso === "papel revogado" ? { papeis: [Papel.PROFESSOR] } : { ativo: false } });
    expect((await solicitarRetomada(alunoId, manter)).ok).toBe(false);
    expect((await aluno()).status).toBe("PAUSADO");
    expect((await prisma.propostaRetomada.findUniqueOrThrow({ where: { id: propostaId } })).status).toBe("PENDENTE");
  });

  it("perda de autorização do solicitante impede aplicar, mas outra pessoa pode rejeitar e destravar a fila", async () => {
    await pausar();
    const propostaId = await propor();
    const antes = await calendario();
    await prisma.usuario.update({ where: { id: sec.id }, data: { ativo: false } });
    entrar(fin.id);
    expect((await decidirRetomada(propostaId, { aprovar: true, motivo })).ok).toBe(false);
    expect((await aluno()).status).toBe("PAUSADO");
    expect(await calendario()).toEqual(antes);
    sucesso(await decidirRetomada(propostaId, { aprovar: false, motivo: "Solicitante não possui mais acesso" }));
    expect((await prisma.propostaRetomada.findUniqueOrThrow({ where: { id: propostaId } })).status).toBe("REJEITADA");
    const nova = await propor(manter, adm.id);
    expect(nova).not.toBe(propostaId);
  });

  it("revogação enquanto a aprovação aguarda o calendário invalida a autorização já lida", async () => {
    await pausar();
    const propostaId = await propor();
    const antes = await calendario();
    entrar(fin.id);
    const pronto = sinal();
    const liberar = sinal();
    let pidBloqueador = 0;
    const bloqueador = prisma.$transaction(async (tx) => {
      const [conexao] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      pidBloqueador = conexao.pid;
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${matriculaId} FOR UPDATE`;
      pronto.liberar();
      await liberar.promessa;
    }, { timeout: 8000 });
    await Promise.race([pronto.promessa, bloqueador]);
    const decisao = decidirRetomada(propostaId, { aprovar: true, motivo });
    try {
      let aguardouCalendario = false;
      const limite = Date.now() + 3000;
      while (Date.now() < limite) {
        const bloqueadas = await prisma.$queryRaw<{ aguardando: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM pg_stat_activity atividade
            WHERE ${pidBloqueador} = ANY(pg_blocking_pids(atividade.pid))
          ) AS aguardando
        `;
        if (bloqueadas[0].aguardando) { aguardouCalendario = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(aguardouCalendario, "A decisão deve alcançar o lock real do calendário").toBe(true);
      await prisma.usuario.update({ where: { id: fin.id }, data: { papeis: [Papel.VENDEDOR] } });
    } finally {
      liberar.liberar();
      await bloqueador;
      await decisao;
    }
    expect((await decisao).ok).toBe(false);
    expect((await aluno()).status).toBe("PAUSADO");
    expect(await calendario()).toEqual(antes);
    expect((await prisma.propostaRetomada.findUniqueOrThrow({ where: { id: propostaId } })).status).toBe("PENDENTE");
    expect(await movimentosRetomada()).toHaveLength(0);
  });
});

describe("proposta não se aplica sobre um calendário diferente", () => {
  it.each(["pagamento", "ajuste", "nova parcela", "matrícula encerrada", "aluno encerrado", "nova pausa"])("recusa aprovação após %s e preserva a mudança posterior", async (mudanca) => {
    await pausar();
    const propostaId = await propor(await reprogramacao());
    if (mudanca === "pagamento") await pagar(parcelas.atrasada.id, 20);
    if (mudanca === "ajuste") {
      entrar(fin.id);
      expect(sucesso(await ajustarCobranca({ cobrancaId: parcelas.atrasada.id, tipo: TipoAjuste.DESCONTO, valorPara: 90, vigencia: Vigencia.ESTA_COBRANCA, motivo: "Ajuste posterior à proposta" })).aprovacao).toBe(false);
    }
    if (mudanca === "nova parcela") await criarCobranca(matriculaId, 120, 333);
    if (mudanca === "matrícula encerrada") await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "ENCERRADA" } });
    if (mudanca === "aluno encerrado") await prisma.aluno.update({ where: { id: alunoId }, data: { status: "ENCERRADO" } });
    if (mudanca === "nova pausa") {
      // Simula mudança externa de estado; o endpoint antigo não é usado como atalho.
      await prisma.aluno.update({ where: { id: alunoId }, data: { status: "ATIVO" } });
      await pausar();
    }
    const estadoPosterior = { aluno: await aluno(), matricula: await matricula(), calendario: await calendario(), recebimentos: await recebimentos() };
    entrar(fin.id);
    expect((await decidirRetomada(propostaId, { aprovar: true, motivo })).ok).toBe(false);
    expect({ aluno: await aluno(), matricula: await matricula(), calendario: await calendario(), recebimentos: await recebimentos() }).toEqual(estadoPosterior);
    expect(await movimentosRetomada()).toHaveLength(0);
    expect((await prisma.propostaRetomada.findUniqueOrThrow({ where: { id: propostaId } })).status).toBe("PENDENTE");
  });

  it("rejeita datas inválidas, retroativas, omissões e cobranças alheias sem deixar proposta parcial", async () => {
    await pausar();
    const valido = await reprogramacao();
    const datas = valido.novosVencimentos!;
    const invalidos: SolicitarRetomadaInput[] = [
      { ...valido, novosVencimentos: datas.map((p) => ({ ...p, vencimento: diaEm(-1) })) },
      { ...valido, novosVencimentos: datas.map((p) => ({ ...p, vencimento: "2099-02-30" })) },
      { ...valido, novosVencimentos: datas.slice(1) },
      { ...valido, novosVencimentos: [...datas, datas[0]] },
      { ...valido, novosVencimentos: [...datas, { cobrancaId: parcelas.taxa.id, vencimento: diaEm(20) }] },
      { ...valido, novosVencimentos: datas.map((p, i) => i === 0 ? { ...p, cobrancaId: "cobranca-de-outro-aluno" } : p) },
      { ...manter, novosVencimentos: datas },
    ];
    const antes = await calendario();
    for (const input of invalidos) expect((await solicitarRetomada(alunoId, input)).ok).toBe(false);
    expect(await calendario()).toEqual(antes);
    expect(await prisma.propostaRetomada.count()).toBe(0);
    expect((await aluno()).status).toBe("PAUSADO");
  });

  it("não normaliza saldo parcial divergente ao propor retomada", async () => {
    await pausar();
    await prisma.cobranca.update({ where: { id: parcelas.parcial.id }, data: { saldo: 200 } });
    const contexto = sucesso(await listarContextoRetomada(alunoId));
    expect(contexto.impedimento).toMatch(/saldo|concilia/i);
    expect((await solicitarRetomada(alunoId, manter)).ok).toBe(false);
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: parcelas.parcial.id } })).saldo!.toFixed(2)).toBe("200.00");
    expect(await prisma.propostaRetomada.count()).toBe(0);
  });

  it("duas propostas concorrentes deixam apenas uma pendente e não aplicam calendário", async () => {
    await pausar();
    const antes = await calendario();
    const resultados = await Promise.all([solicitarRetomada(alunoId, manter), solicitarRetomada(alunoId, manter)]);
    expect(resultados.some((r) => r.ok)).toBe(true);
    expect(await prisma.propostaRetomada.count({ where: { alunoId, status: "PENDENTE" } })).toBe(1);
    expect((await aluno()).status).toBe("PAUSADO");
    expect(await calendario()).toEqual(antes);
  });

  it("replay de REPROGRAMAR com entrada invertida reutiliza a proposta sem evento ou aplicação adicional", async () => {
    // A ordem por ID é deliberadamente diferente da ordem visual dos vencimentos.
    await prisma.cobranca.createMany({ data: [
      { id: "z-primeiro-vencimento", matriculaId, tipo: "MENSALIDADE", status: "ATRASADO", vencimento: dataEm(-60), valorOriginal: 100, valorNegociado: 100, valorRecebido: 0, saldo: 100, moeda: "CRC" },
      { id: "a-ultimo-vencimento", matriculaId, tipo: "MENSALIDADE", status: "PENDENTE", vencimento: dataEm(200), valorOriginal: 100, valorNegociado: 100, valorRecebido: 0, saldo: 100, moeda: "CRC" },
    ] });
    await pausar();
    const antes = await calendario();
    const ledger = await recebimentos();
    const idsVisuais = sucesso(await listarContextoRetomada(alunoId)).parcelas.map((p) => p.cobrancaId);
    expect(idsVisuais[0]).toBe("z-primeiro-vencimento");
    expect(idsVisuais.at(-1)).toBe("a-ultimo-vencimento");
    expect(idsVisuais).not.toEqual([...idsVisuais].sort());
    const input = await reprogramacao();
    const propostaId = await propor(input);
    const proposta = await prisma.propostaRetomada.findUniqueOrThrow({ where: { id: propostaId } });
    const eventos = await prisma.evento.findMany({ orderBy: { id: "asc" } });
    expect(eventos.filter((e) => e.tipo === "RetomadaSolicitada")).toHaveLength(1);

    const replay = sucesso(await solicitarRetomada(alunoId, { ...input, novosVencimentos: [...input.novosVencimentos!].reverse() }));

    expect(replay.propostaId).toBe(propostaId);
    expect(await prisma.propostaRetomada.findMany({ where: { alunoId } })).toEqual([proposta]);
    expect(await prisma.evento.findMany({ orderBy: { id: "asc" } })).toEqual(eventos);
    expect(await calendario()).toEqual(antes);
    expect(await recebimentos()).toEqual(ledger);
    expect((await aluno()).status).toBe("PAUSADO");
    expect(await movimentosRetomada()).toHaveLength(0);
  });

  it("aprovações concorrentes e replay aplicam a retomada exatamente uma vez", async () => {
    await pausar();
    const input = await reprogramacao();
    const propostaId = await propor(input);
    const antes = await calendario();
    const ledger = await recebimentos();
    entrar(fin.id);
    const decidir = () => decidirRetomada(propostaId, { aprovar: true, motivo: "Aprovação repetida em duas abas" });
    const resultados = await Promise.all([decidir(), decidir()]);
    expect(resultados.some((r) => r.ok)).toBe(true);
    const depois = await calendario();
    await decidir();
    expect(await calendario()).toEqual(depois);
    expect(await recebimentos()).toEqual(ledger);
    for (const c of depois) {
      const elegivel = input.novosVencimentos!.some((p) => p.cobrancaId === c.id);
      expect(c.versao).toBe(antes.find((p) => p.id === c.id)!.versao + Number(elegivel));
    }
    expect(await movimentosRetomada()).toHaveLength(1);
    expect((await eventosDo("Aluno", alunoId)).filter((e) => e.tipo === "AlunoReativado")).toHaveLength(1);
    expect((await prisma.propostaRetomada.findUniqueOrThrow({ where: { id: propostaId } })).status).toBe("APROVADA");
  });

  it("aprovar e rejeitar ao mesmo tempo produzem uma decisão coerente e uma única aplicação possível", async () => {
    await pausar();
    const antes = await calendario();
    const propostaId = await propor();
    entrar(fin.id);
    const resultados = await Promise.all([decidirRetomada(propostaId, { aprovar: true, motivo }), decidirRetomada(propostaId, { aprovar: false, motivo })]);
    expect(resultados.some((r) => r.ok)).toBe(true);
    const proposta = await prisma.propostaRetomada.findUniqueOrThrow({ where: { id: propostaId } });
    expect(["APROVADA", "REJEITADA"]).toContain(proposta.status);
    expect(proposta.aprovadorId).toBe(fin.id);
    expect(proposta.decididoEm).not.toBeNull();
    const aprovada = proposta.status === "APROVADA";
    expect((await aluno()).status).toBe(aprovada ? "ATIVO" : "PAUSADO");
    expect(await movimentosRetomada()).toHaveLength(Number(aprovada));
    if (!aprovada) expect(await calendario()).toEqual(antes);
  });
});

describe("legado, ativação e acesso às aulas", () => {
  it.each([false, true])("pausa legada com cancelamento ambíguo=%s não presume origem financeira", async (cancelada) => {
    const pessoa = await prisma.aluno.create({ data: { primeiroNome: "Legado", paisId: catalogo.pais.id, status: "PAUSADO" } });
    const m = await prisma.matricula.create({ data: { alunoId: pessoa.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
    await prisma.movimentacaoAluno.create({ data: { alunoId: pessoa.id, usuarioId: sec.id, tipo: "PAUSA", statusOrigem: "ATIVO", statusDestino: "PAUSADO", motivo: "Importação de pausa histórica" } });
    const c = await criarCobranca(m.id, -5, 100, { status: cancelada ? "CANCELADA" : "ATRASADO" });
    entrar(sec.id);
    const contexto = sucesso(await listarContextoRetomada(pessoa.id));
    const resultado = await solicitarRetomada(pessoa.id, manter);
    if (cancelada) {
      expect(contexto.impedimento).toMatch(/legada|origem/i);
      expect(resultado.ok).toBe(false);
      expect(await prisma.cobranca.findUnique({ where: { id: c.id } })).toMatchObject({ status: "CANCELADA", canceladaPorPausaId: null });
    } else {
      expect(contexto.impedimento).toBeNull();
      const propostaId = sucesso(resultado).propostaId;
      entrar(fin.id);
      sucesso(await decidirRetomada(propostaId, { aprovar: true, motivo }));
      expect((await prisma.aluno.findUniqueOrThrow({ where: { id: pessoa.id } })).status).toBe("ATIVO");
      expect(await prisma.cobranca.findUnique({ where: { id: c.id } })).toEqual(c);
    }
  });

  it.each(["PAUSADO", "ENCERRADO"] as const)("concluir e ativar matrícula AGUARDANDO de aluno %s não geram calendário nem baixa", async (status) => {
    const m = await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "AGUARDANDO", mesesPlano: 4 } });
    const contrato = await prisma.documento.create({ data: { matriculaId: m.id, categoria: "CONTRATO", nome: "Contrato aceito", url: "/api/files/contrato-retomada.pdf" } });
    await prisma.matricula.update({ where: { id: m.id }, data: { contratoOk: true, contratoDocumentoId: contrato.id, confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: sec.id } });
    const taxa = await criarCobranca(m.id, 0, 50, { tipo: "MATRICULA" });
    await criarCobranca(m.id, 10, 100);
    await pagar(taxa.id, 50);
    await prisma.aluno.update({ where: { id: alunoId }, data: { status } });
    const cobrancasAntes = await prisma.cobranca.findMany({ where: { matriculaId: m.id }, orderBy: { id: "asc" } });
    const ledgerAntes = await prisma.recebimento.findMany({ where: { cobranca: { matriculaId: m.id } } });
    entrar(adm.id);
    for (const resultado of [await concluirMatricula(m.id), await ativarMatricula(m.id, { valorRecebido: 0, forma: "DINHEIRO", dataPagamento: diaEm(0) })]) {
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.erro).toMatch(/aluno|pausad|encerrad|retomada/i);
    }
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("AGUARDANDO");
    expect(await prisma.cobranca.findMany({ where: { matriculaId: m.id }, orderBy: { id: "asc" } })).toEqual(cobrancasAntes);
    expect(await prisma.recebimento.findMany({ where: { cobranca: { matriculaId: m.id } } })).toEqual(ledgerAntes);
    expect((await eventosDo("Matricula", m.id)).some((e) => e.tipo === "MatriculaAtivada")).toBe(false);
  });

  it("MANTER recalcula D30; REPROGRAMAR regulariza só o componente automático e preserva bloqueio manual", async () => {
    await rodarControleAcessoAulas();
    expect(await matricula()).toMatchObject({ acessoBloqueioAutomatico: true, acessoBloqueado: true });
    await pausar();
    const propostaManter = await propor();
    entrar(fin.id);
    sucesso(await decidirRetomada(propostaManter, { aprovar: true, motivo }));
    expect(await matricula()).toMatchObject({ acessoBloqueioAutomatico: true, acessoBloqueado: true });
    const bloqueadoEm = dataEm(-60);
    await prisma.matricula.update({ where: { id: matriculaId }, data: { acessoBloqueioManual: true, acessoBloqueado: true, bloqueadoEm } });
    await pausar();
    const propostaNova = await propor(await reprogramacao());
    entrar(fin.id);
    sucesso(await decidirRetomada(propostaNova, { aprovar: true, motivo }));
    expect(await matricula()).toMatchObject({ acessoBloqueioAutomatico: false, acessoBloqueioManual: true, acessoBloqueado: true, bloqueadoEm });
    expect((await aluno()).status).toBe("ATIVO");
  });
});
