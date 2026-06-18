import { PrismaClient, Papel } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash("genius123", 10);

  const usuarios: {
    nome: string;
    email: string;
    papeis: Papel[];
    limiteDescontoPct: number | null;
  }[] = [
    {
      nome: "Diógenes Mendes",
      email: "admin@genius.com",
      papeis: [Papel.ADMINISTRADOR],
      limiteDescontoPct: null, // sem limite
    },
    {
      nome: "Mariana López",
      email: "mariana@genius.com",
      papeis: [Papel.GERENTE_COMERCIAL, Papel.VENDEDOR],
      limiteDescontoPct: 15,
    },
    {
      nome: "João Silva",
      email: "joao@genius.com",
      papeis: [Papel.VENDEDOR],
      limiteDescontoPct: 10,
    },
    {
      nome: "Ana Torres",
      email: "ana@genius.com",
      papeis: [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA],
      limiteDescontoPct: null,
    },
    {
      nome: "Carla Fernández",
      email: "carla@genius.com",
      papeis: [Papel.PROFESSOR],
      limiteDescontoPct: null,
    },
  ];

  for (const u of usuarios) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: { nome: u.nome, papeis: u.papeis, limiteDescontoPct: u.limiteDescontoPct },
      create: { ...u, senhaHash },
    });
  }

  // contadores dos códigos legíveis (L-/A-/M-/C-/T-)
  for (const chave of ["lead", "aluno", "matricula", "cobranca", "turma"]) {
    await prisma.contador.upsert({
      where: { chave },
      update: {},
      create: { chave, valor: 0 },
    });
  }

  console.log("Seed concluído.");
  console.log("Login admin:  admin@genius.com  /  genius123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
