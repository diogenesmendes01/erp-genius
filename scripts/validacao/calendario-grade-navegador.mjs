import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
const db = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:teste@localhost:54329/erp_genius_test" } } });
const arquivo = "node_modules/.implementation/calendario-grade-navegador.json";
try {
 if (process.argv[2] === "verificar") {
  const f = JSON.parse(await fs.readFile(arquivo, "utf8"));
  const calendario = await db.versaoCalendarioEscolar.findFirst({ where: { motivo: f.motivo }, include: { decisao: true } });
  const grades = await db.propostaGradeTurma.findMany({ where: { turmaId: f.turmaId }, include: { decisao: true, encontros: true } });
  const g = grades[0];
  const checks = { calendarioPreparador: calendario?.preparadorId === f.secretariaId,
   calendarioAprovado: calendario?.decisao?.aprovada === true && calendario.decisao.decisorId === f.gestorId,
   periodoPreservado: Array.isArray(calendario?.periodos) && calendario.periodos.some((p) => p.nome === "Feriado de validação" && p.inicio === "2099-10-01"),
   gradeUnica: grades.length === 1, gradePreparador: g?.preparadorId === f.secretariaId,
   gradeAprovada: g?.decisao?.aprovada === true && g.decisao.decisorId === f.gestorId,
   encontrosPublicados: g?.encontros.length === 3 && g.encontros.every((e) => e.status === "PREVISTO" && e.professorId === f.professorId),
   feriadoRespeitado: g?.encontros.every((e) => e.inicio.toISOString().slice(0,10) !== "2099-10-01") === true };
  await fs.writeFile("docs/validacao-calendario-grade-navegador-2026-09-11.json", JSON.stringify({ executadoEm: new Date().toISOString(), ambiente: "Banco local descartável; dados fictícios", checks }, null, 2));
  console.log(JSON.stringify(checks)); if(Object.values(checks).some((x) => !x)) process.exitCode=1;
 } else {
  if (await db.encontroAgenda.count({ where: { status: "PREVISTO" } })) throw new Error("Fixture exige banco de teste sem encontros previstos para publicar calendário inicial.");
  const senhaHash = await bcrypt.hash("Somente-Teste-Local-2026!",10);
  const usuario = (email,papeis) => db.usuario.upsert({ where:{email}, create:{email,nome:email.split("@")[0],senhaHash,papeis},update:{ativo:true,senhaHash,papeis} });
  const secretaria = await usuario("calendario-secretaria@validacao.test",["SECRETARIA_ACADEMICA"]);
  const gestor = await usuario("calendario-gestor@validacao.test",["GERENTE_PEDAGOGICO"]);
  const professor = await usuario("calendario-professor@validacao.test",["PROFESSOR"]);
  await db.configuracaoOperacional.upsert({ where:{id:"escola"},create:{id:"escola",fusoInstitucional:"UTC"},update:{fusoInstitucional:"UTC"} });
  const idioma = await db.idioma.findFirstOrThrow();
  const tag=Date.now().toString();
  const modalidade=await db.modalidade.create({data:{nome:`Grade UI ${tag}`,frequencia:"2x/semana",duracaoPorNivel:"3 aulas",aulasPorNivel:3,horasAula:1}});
  const nivel=await db.nivel.create({data:{idiomaId:idioma.id,codigo:`UI${tag}`,ordem:50}});
  const turma=await db.turma.create({data:{codigo:`GRADE-UI-${tag}`,modalidadeId:modalidade.id,nivelId:nivel.id,professorId:professor.id,diasSemana:[2,4],horarioInicio:"19:00",horarioFim:"20:00",dataInicio:new Date("2099-10-01"),dataFim:new Date("2099-11-01")}});
  const f={turmaId:turma.id,codigo:turma.codigo,secretariaId:secretaria.id,gestorId:gestor.id,professorId:professor.id,motivo:`Calendário UI ${tag}`};
  await fs.mkdir("node_modules/.implementation",{recursive:true});await fs.writeFile(arquivo,JSON.stringify(f));console.log(JSON.stringify(f));
 }
} finally {await db.$disconnect();}
