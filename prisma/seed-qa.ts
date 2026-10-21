import { PrismaClient, Papel } from "@prisma/client";
import bcrypt from "bcryptjs";

// Seed ADICIONAL de QA/UAT (docs/qa/02-usuarios-e-papeis.md; auditoria consolidada B3).
// Cria/atualiza (upsert por e-mail) os usuários de papel ÚNICO que o seed principal não tem:
// Gerente Pedagógico, Gerente Comercial puro, Financeiro puro, Secretaria pura e um 2º Vendedor
// (escopo por linha: vendedor A não vê lead/aluno do vendedor B).
//
// NÃO substitui prisma/seed.ts — rode o seed principal antes (catálogo, contadores, WhatsApp).
// A senha vem de QA_SEED_PASSWORD (obrigatória). Nunca use a senha de dev do seed principal.
//
//   QA_SEED_PASSWORD='...' npm run seed:qa

const prisma = new PrismaClient();

// Mesmo mínimo do formulário de usuários (src/server/acesso/schema.ts).
const SENHA_MIN = 6;

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

  const senhaHash = await bcrypt.hash(senha, 10);

  const usuarios: {
    nome: string;
    email: string;
    papeis: Papel[];
    limiteDescontoPct: number | null;
  }[] = [
    {
      nome: "Paula Gómez",
      email: "gp@genius.com",
      papeis: [Papel.GERENTE_PEDAGOGICO],
      limiteDescontoPct: null,
    },
    {
      nome: "Ricardo Vargas",
      email: "gerente@genius.com",
      papeis: [Papel.GERENTE_COMERCIAL],
      limiteDescontoPct: 20, // exemplo do doc 07; hoje GC puro não concede desconto (auditoria R4)
    },
    {
      nome: "Fernanda Rojas",
      email: "financeiro@genius.com",
      papeis: [Papel.FINANCEIRO],
      limiteDescontoPct: null, // Financeiro já é sem limite no código
    },
    {
      nome: "Sofía Mora",
      email: "secretaria@genius.com",
      papeis: [Papel.SECRETARIA_ACADEMICA],
      limiteDescontoPct: null,
    },
    {
      nome: "Pedro Castro",
      email: "vendedor2@genius.com",
      papeis: [Papel.VENDEDOR],
      limiteDescontoPct: 10,
    },
    {
      nome: "Lucía Herrera",
      email: "vendedor3@genius.com",
      papeis: [Papel.VENDEDOR],
      limiteDescontoPct: null, // vazio = 0% de autonomia para Vendedor (todo desconto vai p/ aprovação)
    },
    {
      nome: "Marcos Jiménez",
      email: "professor2@genius.com",
      papeis: [Papel.PROFESSOR],
      limiteDescontoPct: null, // segundo professor: escopo por turma e experimental atribuída a outro
    },
  ];

  for (const u of usuarios) {
    // update também redefine a senha e reativa: re-rodar o script devolve o usuário ao estado de QA.
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {
        nome: u.nome,
        papeis: u.papeis,
        limiteDescontoPct: u.limiteDescontoPct,
        senhaHash,
        ativo: true,
      },
      create: { ...u, senhaHash },
    });
  }

  console.log(`Seed de QA concluído: ${usuarios.length} usuários de papel único.`);
  for (const u of usuarios) {
    console.log(`  ${u.email.padEnd(24)} ${u.papeis.join(", ")}`);
  }
  console.log("Senha: a definida em QA_SEED_PASSWORD (não é exibida).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
