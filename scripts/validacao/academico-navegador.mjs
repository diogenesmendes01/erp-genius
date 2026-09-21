// Dados fictícios no banco descartável fixo; nunca usa DATABASE_URL do ambiente.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";

const modo = process.argv[2] ?? "preparar";
if (!["preparar", "verificar-pendente", "verificar-aprovada", "verificar"].includes(modo)) throw new Error("Use preparar, verificar-pendente, verificar-aprovada ou verificar.");
const db = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:teste@localhost:54329/erp_genius_test" } } });
const arquivo = "node_modules/.implementation/academico-navegador-fixture.json";
const senha = "Somente-Teste-Local-2026!";
const emDias = (dias) => { const data = new Date(); data.setDate(data.getDate() + dias); data.setHours(12, 0, 0, 0); return data; };
async function protegido(matriculaId, aulaId) {
  return JSON.parse(JSON.stringify({
    matricula: await db.matricula.findUniqueOrThrow({ where: { id: matriculaId } }),
    cobrancas: await db.cobranca.findMany({ where: { matriculaId }, orderBy: { id: "asc" }, include: { recebimentos: { orderBy: { id: "asc" } } } }),
    aula: await db.aulaDiario.findUniqueOrThrow({ where: { id: aulaId }, include: { registros: { orderBy: { id: "asc" } } } }),
  }));
}

try {
  if (modo === "preparar") {
    const usuarios = {};
    for (const [chave, nome, papel] of [
      ["secretaria", "Secretaria acadêmica de validação", "SECRETARIA_ACADEMICA"],
      ["gestao", "Gestão pedagógica de validação", "GERENTE_PEDAGOGICO"],
      ["financeiro", "Financeiro de validação acadêmica", "FINANCEIRO"],
      ["professor", "Professor de validação acadêmica", "PROFESSOR"],
      ["professor_destino", "Professor da turma de destino", "PROFESSOR"],
    ]) {
      const email = `academico-${chave}@validacao.test`;
      usuarios[chave] = await db.usuario.upsert({ where: { email }, create: { email, nome, senhaHash: await bcrypt.hash(senha, 10), papeis: [papel] }, update: { ativo: true, papeis: [papel], senhaHash: await bcrypt.hash(senha, 10) } });
    }
    const pais = await db.pais.upsert({ where: { codigoISO: "ZX" }, create: { nome: "País de validação acadêmica", codigoISO: "ZX", moedaLocal: "BRL", ddi: "+55", status: "ATIVO" }, update: {} });
    const idioma = await db.idioma.create({ data: { nome: `Idioma acadêmico ${randomUUID().slice(0, 8)}` } });
    const modalidade = await db.modalidade.create({ data: { nome: "Curso de validação acadêmica", frequencia: "2x/semana", duracaoPorNivel: "3 meses" } });
    const produto = await db.produto.create({ data: { idiomaId: idioma.id, modalidadeId: modalidade.id } });
    const a1 = await db.nivel.create({ data: { idiomaId: idioma.id, codigo: "A1", ordem: 1 } });
    const a2 = await db.nivel.create({ data: { idiomaId: idioma.id, codigo: "A2", ordem: 2 } });
    const turmas = {};
    for (const [chave, nome, nivelId, professorId] of [["origem", "Origem da validação A1", a1.id, usuarios.professor.id], ["destino", "Destino da validação A2", a2.id, usuarios.professor_destino.id]]) {
      turmas[chave] = await db.turma.create({ data: {
        nome, nivelId, professorId, modalidadeId: modalidade.id, status: "EM_ANDAMENTO", capacidade: 4,
        diasSemana: [2, 4], horarioInicio: "18:00", horarioFim: "19:00", diasHorario: "Terça e quinta · 18:00–19:00",
        dataInicio: emDias(-30), dataFim: emDias(180), vinculosDocentes: { create: { professorId, inicio: emDias(-30) } },
      } });
    }
    const aluno = await db.aluno.create({ data: { primeiroNome: "Aluno", sobrenome: "Validação Acadêmica", paisId: pais.id } });
    const alocacao = await db.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: turmas.origem.id, criadoEm: emDias(-20) } });
    const matricula = await db.matricula.create({ data: { alunoId: aluno.id, produtoId: produto.id, paisId: pais.id, moeda: "BRL", status: "ATIVA", contratoOk: true, pagamentoTaxaOk: true, primeiraMensalidadeOk: true, ativadaEm: emDias(-20), nivelInicialId: a1.id } });
    await db.cobranca.create({ data: { matriculaId: matricula.id, tipo: "MATRICULA", valorOriginal: 100, valorNegociado: 100, valorRecebido: 100, saldo: 0, moeda: "BRL", vencimento: emDias(-20), status: "PAGO", pagoEm: emDias(-20), recebimentos: { create: { chaveIdempotencia: randomUUID(), autorId: usuarios.financeiro.id, valor: 100, moeda: "BRL", forma: "TRANSFERENCIA", dataPagamento: emDias(-20) } } } });
    const aula = await db.aulaDiario.create({ data: { turmaId: turmas.origem.id, professorId: usuarios.professor.id, ocorridaEm: emDias(-10), conteudo: "Aula anterior preservada na mudança de nível", registros: { create: { alunoId: aluno.id, nomeAluno: "Aluno Validação Acadêmica", presente: true, observacao: "Registro histórico de validação" } } } });
    const fixture = { alunoId: aluno.id, matriculaId: matricula.id, alocacaoOrigemId: alocacao.id, turmaOrigemId: turmas.origem.id, turmaDestinoId: turmas.destino.id, aulaId: aula.id,
      usuarios: Object.fromEntries(Object.entries(usuarios).map(([chave, u]) => [chave, { id: u.id, email: u.email }])), protegido: await protegido(matricula.id, aula.id) };
    await fs.mkdir("node_modules/.implementation", { recursive: true });
    await fs.writeFile(arquivo, JSON.stringify(fixture, null, 2) + "\n");
    console.log(JSON.stringify({ alunoId: aluno.id, ficha: `/alunos/${aluno.id}/academico`, turmaDestinoId: turmas.destino.id, usuarios: Object.fromEntries(Object.entries(fixture.usuarios).map(([k, u]) => [k, u.email])) }));
  } else {
    const fixture = JSON.parse(await fs.readFile(arquivo, "utf8"));
    const esperado = modo === "verificar-pendente" ? "PENDENTE" : modo === "verificar-aprovada" ? "APROVADA" : "EXECUTADA";
    const solicitacoes = await db.solicitacaoMudancaAcademica.findMany({ where: { alunoId: fixture.alunoId }, include: { pareceres: true } });
    const pedido = solicitacoes[0];
    const alocacoes = await db.alocacaoTurma.findMany({ where: { alunoId: fixture.alunoId } });
    const ativa = alocacoes.filter((a) => a.ativa);
    const movimentos = await db.movimentacaoAluno.findMany({ where: { alunoId: fixture.alunoId, tipo: "TROCA_TURMA" } });
    const concluido = esperado === "EXECUTADA";
    const resultados = [
      { id: `Estado da solicitação ${esperado}`, passou: solicitacoes.length === 1 && pedido?.status === esperado },
      { id: "Contrato, cobranças, recebimentos e diário preservados", passou: JSON.stringify(await protegido(fixture.matriculaId, fixture.aulaId)) === JSON.stringify(fixture.protegido) },
      { id: "Uma única alocação ativa", passou: ativa.length === 1 && ativa[0].turmaId === (concluido ? fixture.turmaDestinoId : fixture.turmaOrigemId) },
      { id: "Autoria da solicitação pela secretaria", passou: pedido?.solicitanteId === fixture.usuarios.secretaria.id },
      { id: "Origem, destino e confirmação de horário registrados", passou: pedido?.alocacaoOrigemId === fixture.alocacaoOrigemId && pedido?.turmaOrigemId === fixture.turmaOrigemId && pedido?.turmaDestinoId === fixture.turmaDestinoId && pedido?.horarioCompativel === true },
      { id: "Movimentação somente após execução", passou: concluido ? movimentos.length === 1 && pedido?.movimentacaoId === movimentos[0].id : movimentos.length === 0 && !pedido?.executadoEm },
      { id: "Decisão por pessoa independente", passou: esperado === "PENDENTE" ? !pedido?.aprovadorId : pedido?.aprovadorId === fixture.usuarios.gestao.id && pedido?.aprovadorId !== pedido?.solicitanteId && !!pedido?.motivoDecisao },
      { id: "Parecer docente fundamenta a aprovação", passou: esperado === "PENDENTE" || (!!pedido && pedido.pareceres.length === 1 && pedido.pareceres[0].autorId === fixture.usuarios.professor.id && !pedido.justificativaDispensaParecer) },
      { id: "Execução e histórico da origem coerentes", passou: concluido ? pedido?.executorId === fixture.usuarios.secretaria.id && !!pedido?.motivoExecucao && alocacoes.length === 2 && alocacoes.some((a) => a.id === fixture.alocacaoOrigemId && !a.ativa && !!a.encerradaEm) : alocacoes.length === 1 && !pedido?.executorId },
    ];
    const sufixo = concluido ? "" : `-${esperado.toLowerCase()}`;
    await fs.writeFile(`node_modules/.implementation/academico-navegador${sufixo}.json`, JSON.stringify({ data: new Date().toISOString(), estado: esperado, resultados }, null, 2) + "\n");
    console.log(JSON.stringify({ estado: esperado, total: resultados.length, aprovados: resultados.filter((r) => r.passou).length, falhas: resultados.filter((r) => !r.passou) }));
    if (resultados.some((r) => !r.passou)) process.exitCode = 1;
  }
} finally { await db.$disconnect(); }
