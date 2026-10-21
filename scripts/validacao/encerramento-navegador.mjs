// Dados fictícios somente no banco descartável local; não usa DATABASE_URL do ambiente.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
const db = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:teste@localhost:54329/erp_genius_test" } } });
const arquivo = "node_modules/.implementation/encerramento-navegador.json";
try {
  if (process.argv[2] === "verificar") {
    const f = JSON.parse(await fs.readFile(arquivo, "utf8"));
    const pedidos = await db.solicitacaoEncerramentoMatriculas.findMany({ where: { alunoId: f.alunoId }, include: { itens: true, rascunhos: true } });
    const m = await db.matricula.findMany({ where: { alunoId: f.alunoId } });
    const c = await db.cobranca.findUniqueOrThrow({ where: { id: f.cobrancaId } });
    const r = pedidos[0]?.rascunhos[0];
    const componente = r?.snapshot?.contratos?.[0];
    const checks = {
      pedidoUnico: pedidos.length === 1,
      selecaoExata: pedidos[0]?.itens.length === 1 && pedidos[0].itens[0].matriculaId === f.matriculaId,
      contratosPreservados: m.length === 2 && m.every((x) => x.status === "ATIVA"),
      financeiroPreservado: c.valorNegociado.toFixed(2) === "400.00" && c.status === "PENDENTE" && await db.recebimento.count({ where: { cobrancaId: c.id } }) === 0,
      rascunhoUnico: pedidos[0]?.rascunhos.length === 1,
      calculo: componente?.calculo.totalServico === "200.00" && componente?.calculo.multa.valor === "80.00",
      excecaoPendente: componente?.propostaExcecaoMulta?.valorProposto === "35.00" && componente?.propostaExcecaoMulta?.exigeAprovacaoIndependente === true,
    };
    console.log(JSON.stringify(checks));
    await fs.writeFile("docs/validacao-encerramento-navegador-2026-09-11.json", JSON.stringify({ executadoEm: new Date().toISOString(), ambiente: "Banco descartável local; dados fictícios", alcance: "Pedido e rascunho mensal com exceção de multa, sem aprovação ou execução do acerto", checks }, null, 2) + "\n");
    if (Object.values(checks).some((v) => !v)) process.exitCode = 1;
  } else {
    const usuarios = [];
    for (const sufixo of ["operador", "aprovador"]) usuarios.push(await db.usuario.upsert({ where: { email: `encerramento-${sufixo}@validacao.test` },
      create: { email: `encerramento-${sufixo}@validacao.test`, nome: `Validação ${sufixo}`, senhaHash: await bcrypt.hash("Somente-Teste-Local-2026!", 10), papeis: ["ADMINISTRADOR"] },
      update: { ativo: true, papeis: ["ADMINISTRADOR"], senhaHash: await bcrypt.hash("Somente-Teste-Local-2026!", 10) } }));
    await db.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "America/Sao_Paulo" }, update: { fusoInstitucional: "America/Sao_Paulo" } });
    const produto = await db.produto.findFirstOrThrow(); const pais = await db.pais.findFirstOrThrow();
    const aluno = await db.aluno.create({ data: { primeiroNome: "Validação", sobrenome: "Encerramento", paisId: pais.id } });
    const codigo = `NAV-${randomUUID().slice(0, 8)}`;
    const m = await db.matricula.create({ data: { codigo, alunoId: aluno.id, paisId: pais.id, produtoId: produto.id, moeda: "BRL", status: "ATIVA" } });
    await db.matricula.create({ data: { codigo: `${codigo}-OUTRO`, alunoId: aluno.id, paisId: pais.id, produtoId: produto.id, moeda: "BRL", status: "ATIVA" } });
    const doc = await db.documento.create({ data: { matriculaId: m.id, categoria: "CONTRATO", nome: "Contrato fictício de teste", url: "/api/files/fixture-inexistente.pdf" } });
    await db.matricula.update({ where: { id: m.id }, data: { contratoOk: true, contratoDocumentoId: doc.id, confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: usuarios[0].id } });
    await db.condicoesEncerramentoMatricula.create({ data: { matriculaId: m.id, documentoId: doc.id, preparadorId: usuarios[0].id, decisorId: usuarios[1].id, versao: 1, status: "APROVADA", decididaEm: new Date(), motivo: "Fixture fictícia", motivoDecisao: "Conferência fictícia", regras: { diaEncerramento: "INCLUIR", metodoDesconto: "ANTES_DO_PROPORCIONAL", condicoesDescontos: "Desconto de 100 aplicável no período", multa: { tipo: "VALOR_FIXO", valor: "80", clausulaId: "7", condicoesAplicacao: "Saída antecipada conforme contrato fictício" } } } });
    const c = await db.cobranca.create({ data: { matriculaId: m.id, tipo: "MENSALIDADE", moeda: "BRL", valorOriginal: 500, valorNegociado: 400, vencimento: new Date("2099-09-05"), coberturaInicio: new Date("2099-09-01"), coberturaFim: new Date("2099-09-30") } });
    const f = { alunoId: aluno.id, matriculaId: m.id, cobrancaId: c.id, codigo, caminho: `/alunos/${aluno.id}/movimentacoes` };
    await fs.mkdir("node_modules/.implementation", { recursive: true }); await fs.writeFile(arquivo, JSON.stringify(f)); console.log(JSON.stringify(f));
  }
} finally { await db.$disconnect(); }
