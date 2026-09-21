// Login HTTP real contra build LOCAL dedicado. Nunca usa DATABASE_URL do ambiente.
// Executar após as integrações, sem outra suíte alterando o banco descartável.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
const db = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:teste@localhost:54329/erp_genius_test" } } });
const base = "http://127.0.0.1:3017";
const resultados = [];
const senha = "Somente-Teste-Local-2026!";
const marcador = "CONFIGURACAO_PRIVADA_HTTP_20260908";
const jar = new Map();
async function request(route, options = {}) {
  const response = await fetch(base + route, { ...options, redirect: "manual", headers: { ...options.headers, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } });
  for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0], eq = pair.indexOf("="); jar.set(pair.slice(0, eq), pair.slice(eq + 1)); }
  return response;
}
function verificar(id, passou, detalhe = {}) { resultados.push({ id, passou: !!passou, ...detalhe }); }
async function entrar(papel) {
  jar.clear();
  const email = `http-${papel.toLowerCase()}@validacao.test`;
  const user = await db.usuario.upsert({ where: { email }, create: { email, nome: `HTTP ${papel}`, senhaHash: await bcrypt.hash(senha, 10), papeis: [papel] }, update: { ativo: true, papeis: [papel], senhaHash: await bcrypt.hash(senha, 10) } });
  const csrf = await (await request("/api/auth/csrf")).json();
  await request("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, senha, callbackUrl: base + "/home" }) });
  const session = await (await request("/api/auth/session")).json();
  if (session.user?.id !== user.id) throw new Error(`Login local de ${papel} não foi concluído.`);
  return user;
}
async function pagina(route, textoEsperado, negada = false) {
  const r = await request(route), html = await r.text();
  const redirect = r.headers.get("location") ?? "";
  const bloqueada = redirect.includes("/acesso-negado") || redirect.includes("/login") || /NEXT_REDIRECT[^\n]{0,150}(acesso-negado|login)/.test(html) || /<h1[^>]*>Acesso negado<\/h1>/.test(html);
  if (negada && !bloqueada) await fs.writeFile("node_modules/.implementation/http-negacao.html", html);
  verificar(route, negada ? bloqueada && !html.includes(marcador) && !html.includes("http-administrador@validacao.test") : r.status === 200 && html.includes(textoEsperado) && !html.includes('id="__next_error__"'), { status: r.status, redirecionamento: redirect || null });
  return html;
}
try {
  // Comprova que todos os SQL locais aplicados correspondem aos arquivos entregues.
  const migrations = await db.$queryRawUnsafe('SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
  for (const m of migrations) {
    const bytes = await fs.readFile(path.join("prisma/migrations", m.migration_name, "migration.sql"));
    verificar(`migration:${m.migration_name}`, createHash("sha256").update(bytes).digest("hex") === m.checksum);
  }
  const pais = await db.pais.upsert({ where: { codigoISO: "ZZ" }, create: { nome: marcador, codigoISO: "ZZ", moedaLocal: "BRL", ddi: "+55", status: "ATIVO" }, update: { nome: marcador } });
  await entrar("ADMINISTRADOR");
  for (const [route, titulo] of [["/configuracao/operacao", "Matrícula e conferência"], ["/secretaria", "Matrículas e correções"], ["/carteiras", "Carteiras e coberturas"], ["/diario", "Diário"], ["/comissoes", "Comiss"], ["/financeiro", "Financeiro"], ["/inbox", "Inbox"]]) await pagina(route, titulo);
  await pagina("/academico", "Mudanças acadêmicas");
  const gp = await entrar("GERENTE_PEDAGOGICO");
  await pagina("/academico", "Mudanças acadêmicas");
  const catalogo = await pagina("/configuracao/catalogo", "Níveis");
  verificar("GP não recebe configuração financeira no HTML", !catalogo.includes(marcador));
  await pagina("/configuracao/operacao", "", true);
  await pagina("/configuracao/usuarios", "", true);
  await db.usuario.update({ where: { id: gp.id }, data: { papeis: ["PROFESSOR"] } });
  await pagina("/configuracao/catalogo", "", true);

  const professor = await entrar("PROFESSOR");
  const idioma = await db.idioma.create({ data: { nome: `Idioma HTTP ${randomUUID()}` } });
  const modalidade = await db.modalidade.create({ data: { nome: "Modalidade HTTP", frequencia: "2x", duracaoPorNivel: "3 meses" } });
  const nivel = await db.nivel.create({ data: { idiomaId: idioma.id, codigo: "A1", ordem: 1 } });
  const turma = await db.turma.create({ data: { nome: "Turma HTTP", modalidadeId: modalidade.id, nivelId: nivel.id, professorId: professor.id, vinculosDocentes: { create: { professorId: professor.id, inicio: new Date(Date.now() - 60000) } } } });
  const aluno = await db.aluno.create({ data: { primeiroNome: "Aluno HTTP", paisId: pais.id, email: "segredo-http@validacao.test", telefoneE164: "+5511999998877", alocacoes: { create: { turmaId: turma.id } } } });
  const ficha = await pagina(`/alunos/${aluno.id}`, "Aluno HTTP");
  verificar("Professor não recebe contato pessoal no HTML da ficha", !ficha.includes(aluno.email) && !ficha.includes(aluno.telefoneE164));
  await pagina("/academico", "Mudanças acadêmicas");
  const fichaAcademica = await pagina(`/alunos/${aluno.id}/academico`, "Turma e nível do aluno");
  verificar("Professor não recebe contato pessoal nem financeiro na ficha acadêmica", !fichaAcademica.includes(aluno.email) && !fichaAcademica.includes(aluno.telefoneE164) && !fichaAcademica.includes('"valorRecebido"') && !fichaAcademica.includes('"saldo"'));
  await pagina(`/alunos/${aluno.id}/financeiro`, "", true);
  const semPermissaoExportar = await request("/api/exportacoes/alunos");
  verificar("Exportação negada sem capacidade", semPermissaoExportar.status === 403, { status: semPermissaoExportar.status });
  await db.usuario.update({ where: { id: professor.id }, data: { ativo: false } });
  const form = new FormData(); form.set("file", new File(["%PDF-1.4\n%%EOF"], "teste.pdf", { type: "application/pdf" }));
  const upload = await request("/api/upload", { method: "POST", body: form });
  verificar("Usuário desativado não envia arquivo com cookie anterior", upload.status === 401, { status: upload.status });
  const modelo = await request("/api/alunos/modelo");
  verificar("Usuário desativado não baixa modelo com cookie anterior", modelo.status === 401, { status: modelo.status });
  await pagina("/academico", "", true);
  await entrar("SECRETARIA_ACADEMICA");
  await pagina("/academico", "Mudanças acadêmicas");
  await pagina(`/alunos/${aluno.id}/academico`, "Turma e nível do aluno");
  for (const papel of ["FINANCEIRO", "GERENTE_COMERCIAL", "VENDEDOR"]) {
    await entrar(papel);
    await pagina("/academico", "", true);
    await pagina(`/alunos/${aluno.id}/academico`, "", true);
  }
} catch (erro) {
  verificar("execução HTTP", false, { erro: erro instanceof Error ? erro.message : String(erro) });
} finally {
  const saida = path.resolve("node_modules/.implementation/http-final.json");
  await fs.mkdir(path.dirname(saida), { recursive: true });
  await fs.writeFile(saida, JSON.stringify({ data: new Date().toISOString(), base, resultados }, null, 2) + "\n");
  const falhas = resultados.filter((r) => !r.passou);
  console.log(JSON.stringify({ total: resultados.length, passaram: resultados.length - falhas.length, falhas }, null, 2));
  if (falhas.length) process.exitCode = 1;
  await db.$disconnect();
}
