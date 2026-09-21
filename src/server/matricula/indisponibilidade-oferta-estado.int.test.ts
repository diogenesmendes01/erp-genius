import { beforeEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { conferirIndisponibilidadeOfertaTx } from "./indisponibilidade-oferta-estado";

let matriculaId: string;
let autorId: string;
let confirmadorId: string;

const inicio = new Date("2026-10-01T00:00:00.000Z");
const estado = (id = matriculaId) =>
  prisma.$transaction((tx) =>
    conferirIndisponibilidadeOfertaTx(tx, { matriculaId: id, inicio, fim: inicio }),
  );

async function criarRelato(indice: number, confirmado: boolean) {
  const relato = await prisma.registroIndisponibilidadeOfertaMatricula.create({
    data: {
      matriculaId,
      inicio,
      fim: null,
      motivo: `Indisponibilidade conferida no registro ${indice}.`,
      evidenciaTexto: `Evidência operacional preservada no registro ${indice}.`,
      autorId,
      chaveIdempotencia: `relato-estado-limite-${indice}`,
      entradaHash: "a".repeat(64),
    },
  });
  if (confirmado) {
    await prisma.confirmacaoIndisponibilidadeOfertaMatricula.create({
      data: {
        registroId: relato.id,
        confirmadorId,
        confirmada: true,
        motivo: `Confirmação pedagógica do registro ${indice}.`,
        evidenciaTexto: `Evidência da confirmação do registro ${indice}.`,
        entradaHash: "b".repeat(64),
      },
    });
  }
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  autorId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  confirmadorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  const aluno = await prisma.aluno.create({
    data: { primeiroNome: "Estado", paisId: catalogo.pais.id },
  });
  matriculaId = (
    await prisma.matricula.create({
      data: {
        alunoId: aluno.id,
        paisId: catalogo.pais.id,
        produtoId: catalogo.produto.id,
        moeda: "CRC",
      },
    })
  ).id;
});

it("recusa matrícula inexistente e datas fora do intervalo persistível", async () => {
  await expect(estado("matricula-inexistente")).rejects.toThrow(/Matrícula não encontrada/);
  await expect(
    prisma.$transaction((tx) =>
      conferirIndisponibilidadeOfertaTx(tx, {
        matriculaId,
        inicio: new Date("0000-01-01T00:00:00.000Z"),
        fim: inicio,
      }),
    ),
  ).rejects.toThrow(/0001 e 9999/);
});

it("não deixa positivos além do limite ocultarem a indisponibilidade", async () => {
  for (let indice = 1; indice <= 20; indice++) {
    await criarRelato(indice, false);
  }
  await criarRelato(21, true);

  expect(await estado()).toMatchObject({
    estado: "INDISPONIVEL",
    temMais: false,
    registros: [{ id: expect.any(String) }],
  });
});

it("limita a projeção de confirmações positivas e sinaliza continuação", async () => {
  for (let indice = 1; indice <= 21; indice++) {
    await criarRelato(indice, true);
  }

  const resultado = await estado();
  expect(resultado.estado).toBe("INDISPONIVEL");
  expect(resultado.registros).toHaveLength(20);
  expect(resultado.temMais).toBe(true);
});
