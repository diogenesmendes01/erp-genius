// Massa sintética local para ensaio da interface. Não lê a URL da produção.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const db = new PrismaClient({ datasources: { db: { url: 'postgres://postgres:teste@localhost:54329/erp_genius_test' } } });
try {
  if (!process.env.QA_TERMINO_SENHA) throw new Error('Defina QA_TERMINO_SENHA para as contas sintéticas.');
  const pais = await db.pais.findFirstOrThrow();
  const produto = await db.produto.findFirstOrThrow();
  const senhaHash = await bcrypt.hash(process.env.QA_TERMINO_SENHA, 10);
  const sufixo = Date.now();
  const contas = [];
  for (const [papel, nome] of [['SECRETARIA_ACADEMICA', 'Secretaria QA'], ['GERENTE_PEDAGOGICO', 'Gestão QA'], ['FINANCEIRO', 'Financeiro QA']]) {
    const email = `${papel.toLowerCase()}-${sufixo}@genius.test`;
    await db.usuario.create({ data: { nome, email, senhaHash, papeis: [papel] } });
    contas.push({ papel, email });
  }
  const aluno = await db.aluno.create({ data: { primeiroNome: 'Aluno sintético QA Q156', paisId: pais.id } });
  const matricula = await db.matricula.create({ data: { alunoId: aluno.id, paisId: pais.id, produtoId: produto.id, moeda: pais.moedaLocal } });
  console.log(JSON.stringify({ contas, matriculaId: matricula.id, url: `http://localhost:3017/matriculas/${matricula.id}/indisponibilidade-oferta` }));
} finally { await db.$disconnect(); }
