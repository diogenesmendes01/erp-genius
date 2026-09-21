// Fixtures e verificação somente no banco descartável de teste. Nunca lê DATABASE_URL.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";

const modo = process.argv[2] ?? "preparar";
if (!["preparar", "verificar"].includes(modo)) throw new Error("Use preparar ou verificar.");
const db = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:teste@localhost:54329/erp_genius_test" } } });
const arquivo = "node_modules/.implementation/retomada-navegador-fixture.json";
const senha = "Somente-Teste-Local-2026!";
const emDias = (dias) => { const data = new Date(); data.setDate(data.getDate() + dias); data.setHours(12, 0, 0, 0); return data; };

try {
  if (modo === "preparar") {
    const usuarios = {};
    for (const [nome, papel] of [["Secretaria de validação", "SECRETARIA_ACADEMICA"], ["Financeiro de validação", "FINANCEIRO"]]) {
      const email = `retomada-${papel.toLowerCase()}@validacao.test`;
      usuarios[papel] = await db.usuario.upsert({ where: { email }, create: { email, nome, senhaHash: await bcrypt.hash(senha, 10), papeis: [papel] }, update: { ativo: true, papeis: [papel], senhaHash: await bcrypt.hash(senha, 10) } });
    }
    const pais = await db.pais.upsert({ where: { codigoISO: "ZY" }, create: { nome: "País de validação da retomada", codigoISO: "ZY", moedaLocal: "BRL", ddi: "+55", status: "ATIVO" }, update: {} });
    const idioma = await db.idioma.create({ data: { nome: `Idioma retomada ${randomUUID()}` } });
    const modalidade = await db.modalidade.create({ data: { nome: "Curso de validação", frequencia: "2x/semana", duracaoPorNivel: "3 meses" } });
    const produto = await db.produto.create({ data: { idiomaId: idioma.id, modalidadeId: modalidade.id } });
    const aluno = await db.aluno.create({ data: { primeiroNome: "Aluno", sobrenome: "Validação Retomada", paisId: pais.id } });
    const matricula = await db.matricula.create({ data: { alunoId: aluno.id, produtoId: produto.id, paisId: pais.id, moeda: "BRL", status: "ATIVA", contratoOk: true, pagamentoTaxaOk: true, primeiraMensalidadeOk: true, ativadaEm: emDias(-60) } });
    const cobrancas = [];
    for (const [tipo, offset, recebido, status] of [["MATRICULA", -60, 100, "PAGO"], ["MENSALIDADE", -30, 100, "PAGO"], ["MENSALIDADE", 15, 40, "PENDENTE"], ["MENSALIDADE", 45, 0, "PENDENTE"]]) {
      const vencimento = emDias(offset);
      const c = await db.cobranca.create({ data: {
        matriculaId: matricula.id, tipo, competencia: tipo === "MENSALIDADE" ? vencimento.toISOString().slice(0, 7) : null,
        moeda: "BRL", valorOriginal: 100, valorNegociado: 100, valorRecebido: recebido, saldo: 100 - recebido,
        vencimento, status, pagoEm: status === "PAGO" ? emDias(-10) : null,
        recebimentos: recebido ? { create: { chaveIdempotencia: randomUUID(), autorId: usuarios.FINANCEIRO.id, valor: recebido, moeda: "BRL", forma: "TRANSFERENCIA", dataPagamento: emDias(-10) } } : undefined,
      } });
      cobrancas.push({ id: c.id, tipo, recebido, saldo: 100 - recebido, status, vencimento: c.vencimento.toISOString(), novoVencimento: status === "PENDENTE" ? emDias(offset + 20).toISOString().slice(0, 10) : null });
    }
    const fixture = { alunoId: aluno.id, matriculaId: matricula.id, usuarios: Object.fromEntries(Object.entries(usuarios).map(([papel, u]) => [papel, u.email])), cobrancas };
    await fs.mkdir("node_modules/.implementation", { recursive: true });
    await fs.writeFile(arquivo, JSON.stringify(fixture, null, 2) + "\n");
    console.log(JSON.stringify({ alunoId: aluno.id, ficha: `/alunos/${aluno.id}`, usuarios: fixture.usuarios, novosVencimentos: cobrancas.filter((c) => c.novoVencimento).map((c) => c.novoVencimento) }));
  } else {
    const fixture = JSON.parse(await fs.readFile(arquivo, "utf8"));
    const aluno = await db.aluno.findUniqueOrThrow({ where: { id: fixture.alunoId } });
    const propostas = await db.propostaRetomada.findMany({ where: { alunoId: aluno.id }, include: { solicitante: true, aprovador: true } });
    const cobrancas = await db.cobranca.findMany({ where: { matriculaId: fixture.matriculaId } });
    const recebimentos = await db.recebimento.count({ where: { cobranca: { matriculaId: fixture.matriculaId } } });
    const proposta = propostas.find((p) => p.status === "APROVADA");
    const resultados = [
      { id: "Aluno retomado após aprovação", passou: aluno.status === "ATIVO" },
      { id: "Aprovação por outra pessoa com motivo", passou: !!proposta && proposta.solicitanteId !== proposta.aprovadorId && !!proposta.motivoDecisao },
      { id: "Escolha aprovada foi reprogramação", passou: proposta?.opcao === "REPROGRAMAR_PARCELAS" },
      { id: "Parcelas e recebimentos mantidos sem duplicação", passou: cobrancas.length === fixture.cobrancas.length && recebimentos === 3 },
      ...fixture.cobrancas.map((original) => {
        const atual = cobrancas.find((c) => c.id === original.id);
        return { id: `Cobrança preservada ${original.tipo} ${original.vencimento.slice(0, 10)}`, passou: !!atual && Number(atual.valorNegociado) === 100 && Number(atual.valorRecebido) === original.recebido && Number(atual.saldo) === original.saldo && (original.novoVencimento ? atual.vencimento.toISOString().slice(0, 10) === original.novoVencimento && atual.status === "PENDENTE" && atual.cicloRegua === 1 : atual.vencimento.toISOString() === original.vencimento && atual.status === "PAGO" && atual.cicloRegua === 0) };
      }),
    ];
    await fs.writeFile("node_modules/.implementation/retomada-navegador.json", JSON.stringify({ data: new Date().toISOString(), resultados }, null, 2) + "\n");
    console.log(JSON.stringify({ total: resultados.length, aprovados: resultados.filter((r) => r.passou).length, falhas: resultados.filter((r) => !r.passou) }));
    if (resultados.some((r) => !r.passou)) process.exitCode = 1;
  }
} finally {
  await db.$disconnect();
}
