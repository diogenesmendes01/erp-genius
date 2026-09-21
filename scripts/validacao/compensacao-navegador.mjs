// Verifica exclusivamente a fixture do banco local descartável, após interação pelo navegador.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
const db = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:teste@localhost:54329/erp_genius_test" } } });
try {
  const f = JSON.parse(await fs.readFile("node_modules/.implementation/encerramento-navegador.json", "utf8"));
  const propostas = await db.compensacaoCoberturaMatricula.findMany({ where: { matriculaId: f.matriculaId }, include: { dias: true, preparador: true, decisor: true } });
  const p = propostas[0];
  const c = await db.cobranca.findUniqueOrThrow({ where: { id: f.cobrancaId } });
  const contratos = await db.matricula.findMany({ where: { alunoId: f.alunoId } });
  const checks = {
    propostaUnica: propostas.length === 1,
    aprovadaPorOutraPessoa: p?.status === "APROVADA" && p.preparador.email === "encerramento-operador@validacao.test" && p.decisor?.email === "encerramento-aprovador@validacao.test" && p.preparadorId !== p.decisorId,
    diaCorretoAindaSemDestinacao: p?.dias.length === 1 && p.dias[0].diaOrigem.toISOString().slice(0, 10) === "2099-09-10" && p.dias[0].estado === "PENDENTE" && p.dias[0].destinacaoReferencia === null,
    origemCorreta: p?.cobrancaOrigemId === c.id && p.valorCoberturaOriginal.equals(400),
    cobrancaPreservada: c.valorNegociado.equals(400) && c.status === "PENDENTE" && c.coberturaFim?.toISOString().slice(0, 10) === "2099-09-30" && await db.recebimento.count({ where: { cobrancaId: c.id } }) === 0,
    contratosPreservados: contratos.length === 2 && contratos.every((m) => m.status === "ATIVA"),
  };
  const resultado = { executadoEm: new Date().toISOString(), ambiente: "Banco local descartável; dados fictícios", alcance: "Registro da proposta e aprovação independente pela interface. Não valida recomposição, liquidação, rejeição ou perfis não administrativos no navegador.", checks };
  await fs.writeFile("docs/validacao-compensacao-navegador-2026-09-11.json", JSON.stringify(resultado, null, 2) + "\n");
  console.log(JSON.stringify(checks));
  if (Object.values(checks).some((v) => !v)) process.exitCode = 1;
} finally { await db.$disconnect(); }
