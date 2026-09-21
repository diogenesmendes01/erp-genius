import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
const db = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:teste@localhost:54329/erp_genius_test" } } });
const arquivo = "node_modules/.implementation/indisponibilidade-navegador.json";
try {
  if (process.argv[2] === "verificar") {
    const f = JSON.parse(await fs.readFile(arquivo, "utf8"));
    const pedidos = await db.indisponibilidadeDocente.findMany({ where: { professorId: f.professorId, motivo: f.motivo }, include: { decisao: true } });
    const aula = await db.encontroAgenda.findUniqueOrThrow({ where: { id: f.encontroId } });
    const p = pedidos[0];
    const checks = { pedidoUnico: pedidos.length === 1, autorCorreto: p?.preparadorId === f.professorId,
      fusoCorreto: p?.inicio.toISOString() === "2099-10-01T13:00:00.000Z" && p?.fim.toISOString() === "2099-10-01T15:00:00.000Z",
      aprovacaoIndependente: p?.decisao?.aprovada === true && p.decisao.decisorId === f.gestorId,
      aulaPreservada: aula.status === "PREVISTO" && aula.professorId === f.professorId && aula.inicio.toISOString() === "2099-10-01T13:00:00.000Z",
      impactoRegistrado: Array.isArray(p?.decisao?.encontrosAfetados) && p.decisao.encontrosAfetados.some((e) => e.id === f.encontroId),
    };
    const resultado = { executadoEm: new Date().toISOString(), ambiente: "Banco descartável local, dados fictícios", alcance: "Solicitação e aprovação no navegador; sem remarcação ou cancelamento", checks };
    await fs.writeFile("docs/validacao-indisponibilidade-navegador-2026-09-11.json", JSON.stringify(resultado, null, 2) + "\n");
    console.log(JSON.stringify(checks));
    if (Object.values(checks).some((v) => !v)) process.exitCode = 1;
  } else {
    const senhaHash = await bcrypt.hash("Somente-Teste-Local-2026!", 10);
    const professor = await db.usuario.upsert({ where: { email: "ausencia-professor@validacao.test" }, create: { email: "ausencia-professor@validacao.test", nome: "Professor Ausência Teste", senhaHash, papeis: ["PROFESSOR"] }, update: { ativo: true, senhaHash, papeis: ["PROFESSOR"] } });
    const gestor = await db.usuario.upsert({ where: { email: "ausencia-gestor@validacao.test" }, create: { email: "ausencia-gestor@validacao.test", nome: "Gestor Ausência Teste", senhaHash, papeis: ["GERENTE_PEDAGOGICO"] }, update: { ativo: true, senhaHash, papeis: ["GERENTE_PEDAGOGICO"] } });
    const m = await db.matricula.findFirstOrThrow();
    const chave = `ausencia-ui-${Date.now()}`;
    const aula = await db.encontroAgenda.create({ data: { matriculaId: m.id, professorId: professor.id, preparadorId: gestor.id, inicio: new Date("2099-10-01T13:00:00Z"), fim: new Date("2099-10-01T14:00:00Z"), fusoOrigem: "America/Sao_Paulo", status: "PREVISTO", motivo: "Aula fictícia para verificar ausência", chaveIdempotencia: chave, entradaHash: "fixture" } });
    const f = { professorId: professor.id, gestorId: gestor.id, encontroId: aula.id, motivo: `Licença de validação ${chave}` };
    await fs.mkdir("node_modules/.implementation", { recursive: true });
    await fs.writeFile(arquivo, JSON.stringify(f)); console.log(JSON.stringify(f));
  }
} finally { await db.$disconnect(); }
