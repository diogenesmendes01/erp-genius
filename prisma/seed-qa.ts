import { PrismaClient, Papel, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CAPACIDADES_LISTA } from "../src/lib/capacidades";

// Seed ADICIONAL de QA/UAT (docs/qa/02-usuarios-e-papeis.md; auditoria consolidada B7; relatório 01 §Usuários de teste).
//
// O que este script faz, nesta ordem:
//   1. Cria ou atualiza (upsert por e-mail) os 12 usuários de QA que o seed principal não tem: GC, GP, GP-2, FIN, FIN-2,
//      SEC, VEND-B, VEND-0, PROF-2, ADM-2, VEND+PROF e ALUNO-EQUIPE. Para eles, re-rodar o script devolve tudo ao estado
//      de QA: nome, papéis, senha, ativo = true, alçadas, gerente comercial e permissões extras (o que o ADM mudou pela
//      tela nesses usuários é desfeito).
//   2. Nos usuários do seed principal (prisma/seed.ts), NÃO mexe em senha, nome nem papéis. Só atualiza, com `update` por
//      e-mail, as alçadas novas e o vínculo de gerente de joao (VEND-A) e mariana (GC+V). admin, ana e carla não são
//      tocados. Se o seed principal ainda não rodou, avisa e segue.
//
// Campos gravados (prisma/schema.prisma, model Usuario):
//   - alçadas: `limiteDescontoTaxaPct` e `limiteDescontoMensalidadePct` (os que as regras leem: src/server/financeiro/politica.ts).
//     Vazio (null) = 0% de autonomia, para qualquer papel, inclusive ADM e FIN. O campo antigo `limiteDescontoPct` não é lido
//     por nenhuma regra; nos usuários de QA ele é limpo (null) para não mostrar um número enganoso.
//   - `alcadaAlteradaEm`: atualizado só quando a alçada muda de verdade (mesma regra de src/server/acesso/acoes.ts), porque
//     alterar a alçada invalida aprovações e preparações abertas antes da mudança.
//   - equipe comercial: `gerenteComercialId` -> gerente@genius.com (GC), para joao, vendedor2, vendedor3 e mariana.
//   - permissões extras: `permissoes` (String[], valores de src/lib/capacidades.ts). Só FIN-2 recebe
//     "financeiro.aprovar_acertos" (Aprovar acertos e compensações financeiras).
//
// NÃO substitui prisma/seed.ts: rode o seed principal antes (catálogo, contadores, WhatsApp, 5 usuários de dev).
// NÃO cria leads, alunos, turmas, prazos do portal nem conta do portal do aluno (ver relatório 09 §Dados mínimos do UAT).
// A senha vem de QA_SEED_PASSWORD (obrigatória). Sem ela, o script aborta sem gravar nada. Nunca use a senha de dev do
// seed principal, e não anote a senha em ticket, print ou chat.
//
//   QA_SEED_PASSWORD='...' npm run seed:qa
//
// E-mails sempre em minúsculas: o login converte o e-mail digitado para minúsculas e busca por igualdade exata
// (src/lib/auth.ts), então um e-mail gravado com maiúscula nunca loga (auditoria consolidada X1).

const prisma = new PrismaClient();

// Mesmo mínimo do formulário de usuários (src/server/acesso/schema.ts).
const SENHA_MIN = 6;

const EMAIL_GERENTE_QA = "gerente@genius.com";

type Capacidade = (typeof CAPACIDADES_LISTA)[number];

type UsuarioQa = {
  apelido: string; // como o roteiro de QA chama o usuário
  nome: string;
  email: string;
  papeis: Papel[];
  limiteTaxa: number | null; // limiteDescontoTaxaPct
  limiteMensalidade: number | null; // limiteDescontoMensalidadePct
  naEquipeDoGerente: boolean; // gerenteComercialId = gerente@genius.com
  permissoes: Capacidade[];
};

/** Usuários criados por este script. O GC vem primeiro: os vendedores precisam do id dele. */
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
    permissoes: [], // segunda pessoa da gestão pedagógica: decide o que o GP prepara (regras, calendário, grades)
  },
  {
    apelido: "FIN",
    nome: "Fernanda Rojas",
    email: "financeiro@genius.com",
    papeis: [Papel.FINANCEIRO],
    limiteTaxa: null, // vazio = 0%: desconto pedido pelo FIN também vai para aprovação
    limiteMensalidade: null,
    naEquipeDoGerente: false,
    permissoes: [], // prepara acertos e compensações; quem decide é o FIN-2
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
    limiteTaxa: null, // vazio = 0% de autonomia: todo desconto vai para aprovação
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
    permissoes: [], // segundo professor: escopo por turma e experimental atribuída a outro
  },
  {
    apelido: "ADM-2",
    nome: "Tomás Rivera",
    email: "admin2@genius.com",
    papeis: [Papel.ADMINISTRADOR],
    limiteTaxa: null,
    limiteMensalidade: null,
    naEquipeDoGerente: false,
    permissoes: [], // ADM passa em toda capacidade; serve de "outro administrador" nas decisões independentes
  },
  {
    apelido: "VEND+PROF",
    nome: "Daniel Araya",
    email: "venprof@genius.com",
    papeis: [Papel.VENDEDOR, Papel.PROFESSOR],
    limiteTaxa: null,
    limiteMensalidade: null,
    naEquipeDoGerente: false,
    permissoes: [], // AC03: o escopo docente não abre o financeiro comercial
  },
  {
    apelido: "ALUNO-EQUIPE",
    nome: "Bruno Salas",
    email: "alunoequipe@genius.com",
    // O enum aceita ALUNO num usuário da equipe (o formulário também oferece "Aluno (portal)"). Ao entrar, ele é
    // levado a /portal, que só explica que a área do aluno tem acesso próprio (relatório 01, achado 2).
    papeis: [Papel.ALUNO],
    limiteTaxa: null,
    limiteMensalidade: null,
    naEquipeDoGerente: false,
    permissoes: [],
  },
];

/** Usuários do seed principal: só alçadas e vínculo de gerente. Senha, nome e papéis ficam como o seed principal deixou. */
const AJUSTES_SEED_PRINCIPAL: Pick<UsuarioQa, "apelido" | "email" | "limiteTaxa" | "limiteMensalidade" | "naEquipeDoGerente">[] = [
  { apelido: "VEND-A", email: "joao@genius.com", limiteTaxa: 10, limiteMensalidade: 10, naEquipeDoGerente: true },
  // GC+V: mesmo valor que o seed principal grava no campo antigo (15%). Como ela também é GC, o desconto pedido por ela
  // vai sempre para a direção (ADM).
  { apelido: "GC+V", email: "mariana@genius.com", limiteTaxa: 15, limiteMensalidade: 15, naEquipeDoGerente: true },
];

function decimalOuNull(v: number | null): Prisma.Decimal | null {
  return v === null ? null : new Prisma.Decimal(v);
}

/** Mesma comparação de src/server/acesso/acoes.ts: vazio conta como 0. */
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

  // 1. Usuários de QA (upsert completo).
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
      limiteDescontoPct: null, // campo antigo: nenhuma regra lê
      limiteDescontoTaxaPct: decimalOuNull(u.limiteTaxa),
      limiteDescontoMensalidadePct: decimalOuNull(u.limiteMensalidade),
      permissoes: u.permissoes,
      gerenteComercialId,
      senhaHash,
      ativo: true,
    };
    // update também redefine a senha e reativa: re-rodar o script devolve o usuário ao estado de QA.
    const gravado: { id: string } = await prisma.usuario.upsert({
      where: { email: u.email },
      update: { ...dados, ...(alcadaMudou(atual, u.limiteTaxa, u.limiteMensalidade) ? { alcadaAlteradaEm: agora } : {}) },
      create: { ...dados, email: u.email, alcadaAlteradaEm: agora },
      select: { id: true },
    });
    if (u.email === EMAIL_GERENTE_QA) gerenteId = gravado.id;
  }

  // 2. Usuários do seed principal: só alçadas e equipe, com update por e-mail.
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
