import { beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";
import {
  decidirConferenciaRegraHistorica,
  proporConferenciaRegraHistorica,
  revisarConferenciaRegraHistorica,
} from "./conferencia-regra-historica";

let preparador: string;
let decisor: string;
let turmaId: string;
let destinoId: string;

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

async function publicarRegra() {
  const turma = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const proposta = await prisma.$transaction((tx) =>
    prepararRegraAvaliacaoTx(tx, preparador, {
      nivelId: turma.nivelId,
      versaoEsperada: 0,
      conteudo: regraAvaliacaoTeste(),
      motivo: "Versão publicada para a conferência histórica",
      chaveIdempotencia: "regra-publicada-historica",
    }),
  );
  const regra = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: proposta.id } });
  await prisma.$transaction((tx) =>
    decidirRegraAvaliacaoTx(tx, decisor, {
      regraId: regra.id,
      conteudoHash: regra.conteudoHash,
      aprovada: true,
      motivo: "Publicação independente da versão",
    }),
  );
  return regra.id;
}

async function prepararProposta(chave = "proposta-historica-001") {
  entrar(preparador);
  const revisao = await revisarConferenciaRegraHistorica({ turmaId, destinoId });
  expect(revisao.ok).toBe(true);
  if (!revisao.ok || !revisao.dado) throw new Error("Revisão esperada");
  const proposta = await proporConferenciaRegraHistorica({
    turmaId,
    destinoId,
    estadoHash: revisao.dado.estadoHash,
    versaoEsperada: revisao.dado.versaoEsperada,
    motivo: "Evidência histórica analisada por gestor",
    evidencia: "Ata digitalizada confirma a regra originalmente aplicada.",
    chaveIdempotencia: chave,
  });
  expect(proposta.ok).toBe(true);
  if (!proposta.ok || !proposta.dado) throw new Error("Proposta esperada");
  return { propostaId: proposta.dado.id, estadoHash: revisao.dado.estadoHash };
}

async function inserirDecisaoDireta(propostaId: string, decisorId: string, aprovada: boolean) {
  return prisma.$executeRaw`
    INSERT INTO "DecisaoConferenciaRegraHistoricaTurma"
      (id, "propostaId", "decisorId", aprovada, motivo)
    VALUES
      (${randomUUID()}, ${propostaId}, ${decisorId}, ${aprovada}, ${aprovada ? "Aprovação direta adversarial" : "Rejeição direta de proposta obsoleta"})
  `;
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  preparador = (await criarUsuario([Papel.GERENTE_PEDAGOGICO])).id;
  decisor = (await criarUsuario([Papel.ADMINISTRADOR])).id;
  const nivel = await prisma.nivel.create({
    data: { idiomaId: catalogo.idioma.id, codigo: "HIST-ADV", ordem: 1 },
  });
  turmaId = (
    await prisma.turma.create({
      data: {
        modalidadeId: catalogo.modalidade.id,
        nivelId: nivel.id,
        status: "EM_ANDAMENTO",
        dataInicio: new Date("2025-01-01T00:00:00.000Z"),
      },
    })
  ).id;
  entrar(preparador);
  destinoId = await publicarRegra();
  entrar(preparador);
});

it("rejeita proposta SQL com fotografia mínima, sem depender da validação do servidor", async () => {
  const regra = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: destinoId } });
  const snapshotMinimo = {
    turma: { id: turmaId, nivelId: regra.nivelId },
    destino: { id: destinoId, conteudoHash: regra.conteudoHash },
  };

  await expect(
    prisma.$executeRaw`
      INSERT INTO "PropostaConferenciaRegraHistoricaTurma"
        (id, "turmaId", "destinoId", "preparadorId", versao, snapshot, "estadoHash", motivo, evidencia, "chaveIdempotencia", "entradaHash")
      VALUES
        (${randomUUID()}, ${turmaId}, ${destinoId}, ${preparador}, 1,
         ${JSON.stringify(snapshotMinimo)}::jsonb, ${"0".repeat(64)},
         ${"Proposta SQL direta"}, ${"Evidência direta suficiente"}, ${"sql-minimo-001"}, ${"1".repeat(64)})
    `,
  ).rejects.toThrow(/fotografia/i);
});

it.each(["nome", "data", "status", "alocacao"])(
  "rejeita aprovação SQL quando a fotografia válida muda em %s",
  async (mudanca) => {
    const proposta = await prepararProposta(`proposta-${mudanca}-001`);

    if (mudanca === "nome") {
      await prisma.turma.update({ where: { id: turmaId }, data: { nome: "Turma histórica renomeada" } });
    } else if (mudanca === "data") {
      await prisma.turma.update({
        where: { id: turmaId },
        data: { dataInicio: new Date("2025-01-02T00:00:00.000Z") },
      });
    } else if (mudanca === "status") {
      await prisma.turma.update({ where: { id: turmaId }, data: { status: "CONCLUIDA" } });
    } else {
      const pais = await prisma.pais.findFirstOrThrow();
      const aluno = await prisma.aluno.create({ data: { primeiroNome: "Alocação nova", paisId: pais.id } });
      await prisma.alocacaoTurma.create({ data: { turmaId, alunoId: aluno.id } });
    }

    await expect(inserirDecisaoDireta(proposta.propostaId, decisor, true)).rejects.toThrow(/fotografia|agenda|diário|alocações/i);
    expect((await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } })).regraAvaliacaoId).toBeNull();
  },
);

it("rejeita autoaprovação inserida diretamente em SQL", async () => {
  const proposta = await prepararProposta();

  await expect(inserirDecisaoDireta(proposta.propostaId, preparador, true)).rejects.toThrow(/independente/i);
  expect((await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } })).regraAvaliacaoId).toBeNull();
});

it("aceita rejeitar proposta obsoleta depois que uma proposta posterior foi aplicada", async () => {
  const primeira = await prepararProposta("proposta-obsoleta-001");
  const segunda = await prepararProposta("proposta-atual-002");

  entrar(decisor);
  await expect(
    decidirConferenciaRegraHistorica({
      propostaId: segunda.propostaId,
      estadoHash: segunda.estadoHash,
      aprovada: true,
      motivo: "Aplicação da conferência mais recente",
    }),
  ).resolves.toMatchObject({ ok: true, dado: { aplicada: true } });

  await expect(inserirDecisaoDireta(primeira.propostaId, decisor, false)).resolves.toBe(1);
  const primeiraDecisao = await prisma.decisaoConferenciaRegraHistoricaTurma.findUniqueOrThrow({
    where: { propostaId: primeira.propostaId },
  });
  expect(primeiraDecisao.aprovada).toBe(false);
});