import { expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import { FormaPagamento, Papel, TipoDestinacaoRecebimento } from "@prisma/client";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async importOriginal => {
  const atual = await importOriginal<typeof import("@/server/_shared")>();
  const sessao = async () => {
    const autenticacao = await authMock();
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: autenticacao.user.id } });
    if (!usuario.ativo) throw new atual.ErroAutenticacao();
    return usuario;
  };
  return {
    ...atual,
    exigirSessao: sessao,
    exigirSessaoComPapel: async (...papeis: Papel[]) => {
      const usuario = await sessao();
      atual.exigirPapel(usuario, ...papeis);
      return usuario;
    },
  };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { prepararFixtureSubstituicaoContratual } from "@/test/substituicao-contratual";
import { receberComDestinacoesTx, receberTx } from "@/server/financeiro/recebimentos";
import { prepararCondicoesEncerramento, decidirCondicoesEncerramento } from "./condicoes-encerramento";
import { consultarDesistenciaPreparacao, registrarPedidoDesistenciaPreparacao } from "./desistencia-preparacao";
import { decidirDesistenciaAdministrativa } from "./desistencia-administrativa";
import { prepararAcertoDesistenciaContratual, decidirAcertoDesistenciaContratual } from "./desistencia-acerto-contratual";
import { aplicarAcertoDesistenciaContratual } from "./desistencia-acerto-aplicacao";

const arquivo = "node_modules/.implementation/q249-ui-homologacao-fixture.json";
const senha = "Homologacao-Q249-Local";
const regras = {
  diaEncerramento: "EXCLUIR" as const,
  metodoDesconto: "ANTES_DO_PROPORCIONAL" as const,
  condicoesDescontos: "Condições estruturadas para homologação local da reconferência.",
  multa: { tipo: "SEM_PREVISAO" as const, motivo: "A regra contratual específica substitui a multa genérica." },
  acertoDesistenciaPreparacao: {
    tipo: "VALOR_FIXO" as const,
    valor: "50.00",
    clausulaId: "7.6",
    condicoesAplicacao: { momento: "ANTES_ATIVACAO" as const, unidade: "POR_COBRANCA" as const, alcance: { tipo: "TODAS_COBRANCAS_MATRICULA" as const } },
  },
};

function dado<T>(resultado: { ok: boolean; dado?: T; erro?: string }) {
  if (!resultado.ok || resultado.dado === undefined) throw new Error(resultado.erro ?? "Resultado ausente na fixture Q249.");
  return resultado.dado;
}

function entrar(id: string) {
  authMock.mockResolvedValue({ user: { id } });
}

async function registrarCreditoExterno(input: { matriculaId: string; autorId: string; moeda: string; chave: string; valor: number }) {
  await prisma.$transaction(tx => receberComDestinacoesTx(tx, {
    titularMatriculaId: input.matriculaId,
    autorId: input.autorId,
    chaveIdempotencia: input.chave,
    valorRecebido: input.valor,
    moeda: input.moeda,
    forma: FormaPagamento.TRANSFERENCIA,
    dataPagamento: new Date("2099-11-01T12:00:00.000Z"),
    comentario: "Crédito externo fictício e local para homologação Q249.",
    destinos: [{
      tipo: TipoDestinacaoRecebimento.CREDITO_SEM_DESTINO,
      valor: input.valor,
      evidencia: "Comprovante fictício local conferido para homologação Q249.",
      chaveIdempotencia: `${input.chave}:credito`,
    }],
  }));
}

/** Opt-in: prepara somente o banco descartável. A assinatura e os créditos são
 * fontes sintéticas locais; não há envio ou mensagem a fornecedor externo. */
it.runIf(process.env.HOMOLOGACAO_UI_Q249 === "true")("prepara fixture local para homologação operacional Q249", async () => {
  await truncarBanco();
  const base = await prepararFixtureSubstituicaoContratual(authMock, {
    camposFinanceiros: true,
    semSubstituicao: true,
    ambiente: "SANDBOX",
  });
  const [preparador, aprovador] = await Promise.all([
    criarUsuario([Papel.FINANCEIRO], "Financeiro preparador UI Q249"),
    criarUsuario([Papel.FINANCEIRO], "Financeiro aprovador UI Q249"),
  ]);
  await prisma.usuario.update({ where: { id: aprovador.id }, data: { permissoes: ["financeiro.aprovar_acertos"] } });

  const usuarios = [
    [base.secretariaId, "secretaria-ui249@genius.test"],
    [base.adminId, "admin-ui249@genius.test"],
    [preparador.id, "financeiro-preparador-ui249@genius.test"],
    [aprovador.id, "financeiro-aprovador-ui249@genius.test"],
  ] as const;
  const senhaHash = await bcrypt.hash(senha, 10);
  await Promise.all(usuarios.map(([id, email]) => prisma.usuario.update({ where: { id }, data: { email, senhaHash, ativo: true } })));

  entrar(base.secretariaId);
  const condicoes = dado(await prepararCondicoesEncerramento({
    matriculaId: base.matriculaId,
    artefatoContratualId: base.artefatoFonteId,
    processoAssinaturaId: base.processoId,
    regras,
    motivo: "Condições Q165 aprovadas para preparar a reconferência local.",
  }));
  entrar(base.adminId);
  await decidirCondicoesEncerramento({ id: condicoes.id, aprovar: true, motivo: "Administração aprovou as condições estruturadas da fixture." });
  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, orderBy: { id: "asc" } });
  await prisma.$transaction(tx => receberTx(tx, {
    cobrancaId: cobranca.id,
    autorId: preparador.id,
    chaveIdempotencia: "fixture-q249-pagamento-base",
    valorRecebido: 100,
    forma: FormaPagamento.TRANSFERENCIA,
    dataPagamento: new Date("2099-10-15T12:00:00.000Z"),
    permitirExcedente: true,
    evidencia: "Pagamento base fictício, conferido antes do acerto contratual Q165.",
  }));
  entrar(base.secretariaId);
  const consulta = dado(await consultarDesistenciaPreparacao({ matriculaId: base.matriculaId }));
  const pedidoRegistrado = dado(await registrarPedidoDesistenciaPreparacao({
    matriculaId: base.matriculaId,
    estadoHash: consulta.estadoHash,
    motivo: "Desistência fictícia antes da ativação para homologar Q249.",
    evidenciaPedido: "Atendimento fictício conferido para reproduzir a reconferência financeira local.",
    chaveIdempotencia: "fixture-q249-pedido",
  }));
  const pedido = await prisma.pedidoDesistenciaPreparacao.findUniqueOrThrow({ where: { id: pedidoRegistrado.id } });
  entrar(preparador.id);
  const proposta = dado(await prepararAcertoDesistenciaContratual({
    pedidoId: pedido.id,
    condicoesId: condicoes.id,
    motivo: "Memória contratual inicial para a base da reconferência Q249.",
    chaveIdempotencia: "fixture-q249-acerto",
  }));
  const fotografiaHash = (await prisma.propostaAcertoDesistenciaContratual.findUniqueOrThrow({ where: { id: proposta.id } })).fotografiaHash;
  entrar(aprovador.id);
  const decisao = dado(await decidirAcertoDesistenciaContratual({
    propostaId: proposta.id,
    fotografiaHash,
    aprovada: true,
    motivo: "Financeiro aprovou a memória inicial de forma independente.",
    chaveIdempotencia: "fixture-q249-decide-acerto",
  }));
  entrar(base.adminId);
  dado(await decidirDesistenciaAdministrativa({
    pedidoId: pedido.id,
    estadoHash: pedido.estadoHash,
    aprovada: true,
    motivo: "Administração aprovou a desistência de forma independente.",
  }));
  entrar(aprovador.id);
  dado(await aplicarAcertoDesistenciaContratual({ decisaoId: decisao.id, chaveIdempotencia: "fixture-q249-aplica-acerto" }));

  await registrarCreditoExterno({ matriculaId: base.matriculaId, autorId: preparador.id, moeda: cobranca.moeda, valor: 25, chave: "fixture-q249-fato-1" });

  const fixture = {
    matriculaId: base.matriculaId,
    cobrancaId: cobranca.id,
    moeda: cobranca.moeda,
    rotas: { financeiro: `/matriculas/${base.matriculaId}/desistencia/financeiro` },
    senha,
    usuarios: Object.fromEntries(usuarios.map(([, email]) => [email.split("@")[0].replace("-ui249", ""), email])),
    fatoPosterior: { comando: "HOMOLOGACAO_UI_Q249_FATO_NOVO=true", valor: "10.00" },
  };
  await fs.mkdir("node_modules/.implementation", { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(fixture, null, 2) + "\n");
  expect(await prisma.aplicacaoAcertoDesistenciaContratual.count({ where: { decisao: { proposta: { pedidoId: pedido.id } } } })).toBe(1);
  expect(await prisma.creditoMatricula.count({ where: { matriculaId: base.matriculaId, origemDestinacaoRecebimentoId: { not: null } } })).toBe(1);
  console.log(JSON.stringify({ fixture: arquivo, ...fixture }));
});

it.runIf(process.env.HOMOLOGACAO_UI_Q249_FATO_NOVO === "true")("registra o fato local posterior à primeira aplicação Q249", async () => {
  const fixture = JSON.parse(await fs.readFile(arquivo, "utf8")) as { matriculaId: string; moeda: string };
  const preparador = await prisma.usuario.findUniqueOrThrow({ where: { email: "financeiro-preparador-ui249@genius.test" } });
  await registrarCreditoExterno({ matriculaId: fixture.matriculaId, autorId: preparador.id, moeda: fixture.moeda, valor: 10, chave: "fixture-q249-fato-2" });
  expect(await prisma.creditoMatricula.count({ where: { matriculaId: fixture.matriculaId, origemDestinacaoRecebimentoId: { not: null } } })).toBe(2);
});
