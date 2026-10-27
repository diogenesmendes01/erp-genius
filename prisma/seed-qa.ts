import { PrismaClient, Papel, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CAPACIDADES_LISTA } from "../src/lib/capacidades";

const prisma = new PrismaClient();

const SENHA_MIN = 6;

const EMAIL_GERENTE_QA = "gerente@genius.com";

type Capacidade = (typeof CAPACIDADES_LISTA)[number];

type UsuarioQa = {
  apelido: string;
  nome: string;
  email: string;
  papeis: Papel[];
  limiteTaxa: number | null;
  limiteMensalidade: number | null;
  naEquipeDoGerente: boolean;
  permissoes: Capacidade[];
};

const USUARIOS_QA: UsuarioQa[] = [
  {
    apelido: "GC",
    nome: "Ricardo Vargas",
    email: EMAIL_GERENTE_QA,
    papeis: [Papel.GERENTE_COMERCIAL],
    limiteTaxa: 20,
    limiteMensalidade: 20,
    naEquipeDoGerente: false,
    permissoes: [],
  },
  {
    apelido: "GP",
    nome: "Paula Gómez",
    email: "gp@genius.com",
    papeis: [Papel.GERENTE_PEDAGOGICO],
    limiteTaxa: null,
    limiteMensalidade: null,
    naEquipeDoGerente: false,
    permissoes: [],
  },
  {
    apelido: "GP-2",
    nome: "Elena Quesada",
    email: "gp2@genius.com",
    papeis: [Papel.GERENTE_PEDAGOGICO],
    limiteTaxa: null,
    limiteMensalidade: null,
    naEquipeDoGerente: false,
    permissoes: [],
  },
  {
    apelido: "FIN",
    nome: "Fernanda Rojas",
    email: "financeiro@genius.com",
    papeis: [Papel.FINANCEIRO],
    limiteTaxa: null,
    limiteMensalidade: null,
    naEquipeDoGerente: false,
    permissoes: [],
  },
  {
    apelido: "FIN-2",
    nome: "Gabriel Solís",
    email: "financeiro2@genius.com",
    papeis: [Papel.FINANCEIRO],
    limiteTaxa: null,
    limiteMensalidade: null,
    naEquipeDoGerente: false,
    permissoes: ["financeiro.aprovar_acertos"],
  },
  {
    apelido: "SEC",
    nome: "Sofía Mora",
    email: "secretaria@genius.com",
    papeis: [Papel.SECRETARIA_ACADEMICA],
    limiteTaxa: null,
    limiteMensalidade: null,
    naEquipeDoGerente: false,
    permissoes: [],
  },
  {
    apelido: "VEND-B",
    nome: "Pedro Castro",
    email: "vendedor2@genius.com",
    papeis: [Papel.VENDEDOR],
    limiteTaxa: 10,
    limiteMensalidade: 10,
    naEquipeDoGerente: true,
    permissoes: [],
  },
  {
    apelido: "VEND-0",
    nome: "Lucía Herrera",
    email: "vendedor3@genius.com",
    papeis: [Papel.VENDEDOR],
    limiteTaxa: null,
    limiteMensalidade: null,
    naEquipeDoGerente: true,
    permissoes: [],
  },
  {
    apelido: "PROF-2",
    nome: "Marcos Jiménez",
    email: "professor2@genius.com",
    papeis: [Papel.PROFESSOR],
    limiteTaxa: null,
    limiteMensalidade: null,
    naEquipeDoGerente: false,
    permissoes: [],
  },
  {
    apelido: "ADM-2",
    nome: "Tomás Rivera",
    email: "admin2@genius.com",
    papeis: [Papel.ADMINISTRADOR],
    limiteTaxa: null,
    limiteMensalidade: null,
    naEquipeDoGerente: false,
    permissoes: [],
  },
  {
    apelido: "VEND+PROF",
    nome: "Daniel Araya",
    email: "venprof@genius.com",
    papeis: [Papel.VENDEDOR, Papel.PROFESSOR],
    limiteTaxa: null,
    limiteMensalidade: null,
    naEquipeDoGerente: false,
    permissoes: [],
  },
  {
    apelido: "ALUNO-EQUIPE",
    nome: "Bruno Salas",
    email: "alunoequipe@genius.com",
    papeis: [Papel.ALUNO],
    limiteTaxa: null,
    limiteMensalidade: null,
    naEquipeDoGerente: false,
    permissoes: [],
  },
];

const AJUSTES_SEED_PRINCIPAL: Pick<UsuarioQa, "apelido" | "email" | "limiteTaxa" | "limiteMensalidade" | "naEquipeDoGerente">[] = [
  { apelido: "VEND-A", email: "joao@genius.com", limiteTaxa: 10, limiteMensalidade: 10, naEquipeDoGerente: true },
  { apelido: "GC+V", email: "mariana@genius.com", limiteTaxa: 15, limiteMensalidade: 15, naEquipeDoGerente: true },
];

function decimalOuNull(v: number | null): Prisma.Decimal | null {
  return v === null ? null : new Prisma.Decimal(v);
}

function alcadaMudou(
  atual: { limiteDescontoTaxaPct: Prisma.Decimal | null; limiteDescontoMensalidadePct: Prisma.Decimal | null } | null,
  taxa: number | null,
  mensalidade: number | null,
): boolean {
  if (!atual) return true;
  return (
    Number(atual.limiteDescontoTaxaPct ?? 0) !== Number(taxa ?? 0) ||
    Number(atual.limiteDescontoMensalidadePct ?? 0) !== Number(mensalidade ?? 0)
  );
}

function conferirLista() {
  const emails = new Set<string>();
  for (const u of [...USUARIOS_QA, ...AJUSTES_SEED_PRINCIPAL]) {
    if (u.email !== u.email.trim().toLowerCase()) throw new Error(`E-mail fora do padrão (use minúsculas): ${u.email}`);
    if (emails.has(u.email)) throw new Error(`E-mail repetido na lista do seed de QA: ${u.email}`);
    emails.add(u.email);
  }
  if (USUARIOS_QA[0]?.email !== EMAIL_GERENTE_QA) throw new Error("O gerente comercial de QA precisa ser o primeiro da lista.");
}

async function main() {
  const senha = process.env.QA_SEED_PASSWORD;
  if (!senha || senha.trim().length === 0) {
    console.error(
      "QA_SEED_PASSWORD não definida. Defina a senha dos usuários de QA na variável de ambiente " +
        "QA_SEED_PASSWORD e rode de novo (ex.: QA_SEED_PASSWORD='...' npm run seed:qa). Nada foi gravado.",
    );
    process.exit(1);
  }
  if (senha.length < SENHA_MIN) {
    console.error(`QA_SEED_PASSWORD precisa ter pelo menos ${SENHA_MIN} caracteres. Nada foi gravado.`);
    process.exit(1);
  }
  conferirLista();

  const senhaHash = await bcrypt.hash(senha, 10);
  const agora = new Date();
  let gerenteId: string | null = null;

  for (const u of USUARIOS_QA) {
    if (u.naEquipeDoGerente && !gerenteId) throw new Error(`Gerente comercial de QA ainda não gravado ao processar ${u.email}.`);
    const gerenteComercialId: string | null = u.naEquipeDoGerente ? gerenteId : null;

    const atual = await prisma.usuario.findUnique({
      where: { email: u.email },
      select: { limiteDescontoTaxaPct: true, limiteDescontoMensalidadePct: true },
    });
    const dados = {
      nome: u.nome,
      papeis: u.papeis,
      limiteDescontoPct: null,
      limiteDescontoTaxaPct: decimalOuNull(u.limiteTaxa),
      limiteDescontoMensalidadePct: decimalOuNull(u.limiteMensalidade),
      permissoes: u.permissoes,
      gerenteComercialId,
      senhaHash,
      ativo: true,
    };
    const gravado: { id: string } = await prisma.usuario.upsert({
      where: { email: u.email },
      update: { ...dados, ...(alcadaMudou(atual, u.limiteTaxa, u.limiteMensalidade) ? { alcadaAlteradaEm: agora } : {}) },
      create: { ...dados, email: u.email, alcadaAlteradaEm: agora },
      select: { id: true },
    });
    if (u.email === EMAIL_GERENTE_QA) gerenteId = gravado.id;
  }

  const ausentes: string[] = [];
  for (const u of AJUSTES_SEED_PRINCIPAL) {
    const atual = await prisma.usuario.findUnique({
      where: { email: u.email },
      select: { limiteDescontoTaxaPct: true, limiteDescontoMensalidadePct: true },
    });
    if (!atual) {
      ausentes.push(u.email);
      continue;
    }
    await prisma.usuario.update({
      where: { email: u.email },
      data: {
        limiteDescontoTaxaPct: decimalOuNull(u.limiteTaxa),
        limiteDescontoMensalidadePct: decimalOuNull(u.limiteMensalidade),
        ...(alcadaMudou(atual, u.limiteTaxa, u.limiteMensalidade) ? { alcadaAlteradaEm: agora } : {}),
        gerenteComercialId: u.naEquipeDoGerente ? gerenteId : null,
      },
    });
  }

  const pct = (v: number | null) => (v === null ? "vazio (0%)" : `${v}%`);
  console.log(`Seed de QA concluído: ${USUARIOS_QA.length} usuários de QA gravados.`);
  for (const u of USUARIOS_QA) {
    console.log(
      `  ${u.apelido.padEnd(13)} ${u.email.padEnd(24)} ${u.papeis.join(" + ")}` +
        ` | taxa ${pct(u.limiteTaxa)} / mensalidade ${pct(u.limiteMensalidade)}` +
        (u.naEquipeDoGerente ? ` | equipe de ${EMAIL_GERENTE_QA}` : "") +
        (u.permissoes.length ? ` | permissões: ${u.permissoes.join(", ")}` : ""),
    );
  }
  console.log("Ajustes no seed principal (só alçadas e equipe; senha e papéis intocados):");
  for (const u of AJUSTES_SEED_PRINCIPAL) {
    const status = ausentes.includes(u.email) ? "NÃO ENCONTRADO (rode npm run seed antes)" : "atualizado";
    console.log(
      `  ${u.apelido.padEnd(13)} ${u.email.padEnd(24)} taxa ${pct(u.limiteTaxa)} / mensalidade ${pct(u.limiteMensalidade)}` +
        (u.naEquipeDoGerente ? ` | equipe de ${EMAIL_GERENTE_QA}` : "") +
        ` | ${status}`,
    );
  }
  console.log("Senha dos usuários de QA: a definida em QA_SEED_PASSWORD (não é exibida).");
  if (ausentes.length) {
    console.warn(`Atenção: ${ausentes.join(", ")} não existe(m). Rode \`npm run seed\` e depois este script de novo.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
