import { PrismaClient, Papel, Segmento, TipoCobranca, StatusPais } from "@prisma/client";
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

  await seedCatalogo();

  console.log("Seed concluído.");
  console.log("Login admin:  admin@genius.com  /  genius123");
}

// ------------------------------------------------------------
// Catálogo + preços (decisão P5). Idempotente no nível do bloco:
// se já houver idioma cadastrado, assume catálogo populado e pula.
// ⚠️ Valores = EXEMPLOS documentados (doc 04). A matriz completa
//    (mensalidade × modalidade × país, taxa, hora particular) é a
//    pendência P5 (doc 15) — substituir quando o usuário fornecer.
// ------------------------------------------------------------
async function seedCatalogo() {
  if (await prisma.idioma.findFirst()) {
    console.log("Catálogo já populado — pulando.");
    return;
  }

  // Países (status ATIVO) + tipo de documento
  const paisesData = [
    { nome: "Costa Rica", codigoISO: "CR", moedaLocal: "CRC", ddi: "+506", doc: { nome: "Cédula", validador: "cedula_cr" } },
    { nome: "Panamá", codigoISO: "PA", moedaLocal: "USD", ddi: "+507", doc: { nome: "Cédula/Pasaporte", validador: "passaporte" } },
    { nome: "El Salvador", codigoISO: "SV", moedaLocal: "USD", ddi: "+503", doc: { nome: "DUI", validador: "dui_sv" } },
  ];
  const paises: Record<string, { id: string; moeda: string }> = {};
  for (const p of paisesData) {
    const pais = await prisma.pais.create({
      data: {
        nome: p.nome,
        codigoISO: p.codigoISO,
        moedaLocal: p.moedaLocal,
        ddi: p.ddi,
        idioma: "es",
        status: StatusPais.ATIVO,
        tiposDocumento: { create: [{ nome: p.doc.nome, validador: p.doc.validador }] },
      },
    });
    paises[p.codigoISO] = { id: pais.id, moeda: p.moedaLocal };
  }

  // Idioma + níveis (CEFR)
  const portugues = await prisma.idioma.create({ data: { nome: "Português" } });
  const niveis = ["Pré A1", "A1", "A2", "B1", "B2", "C1", "C2"];
  for (let i = 0; i < niveis.length; i++) {
    await prisma.nivel.create({ data: { idiomaId: portugues.id, codigo: niveis[i], ordem: i } });
  }

  // Modalidades (doc 06; mínimo p/ abrir vive na modalidade)
  const modalidadesData = [
    { nome: "Regular", segmento: Segmento.ADULTO, frequencia: "1x/semana", duracaoPorNivel: "3 meses", aulasPorNivel: 12, minimoAbrir: 4 },
    { nome: "Semi-intensiva", segmento: Segmento.ADULTO, frequencia: "2x/semana", duracaoPorNivel: "2 meses", aulasPorNivel: 16, minimoAbrir: 4 },
    { nome: "Intensiva", segmento: Segmento.ADULTO, frequencia: "3x/semana", duracaoPorNivel: "1 mês e meio", aulasPorNivel: 18, minimoAbrir: 3 },
    { nome: "Super-intensiva", segmento: Segmento.ADULTO, frequencia: "5x/semana", duracaoPorNivel: "1 mês", aulasPorNivel: 20, minimoAbrir: 3 },
    { nome: "Particular", segmento: Segmento.ADULTO, frequencia: "critério do aluno", duracaoPorNivel: "—", aulasPorNivel: null, minimoAbrir: 1 },
    { nome: "Kids Regular", segmento: Segmento.KIDS, frequencia: "1x/semana", duracaoPorNivel: "3 meses", aulasPorNivel: 12, minimoAbrir: 5 },
    { nome: "Kids Intensivo", segmento: Segmento.KIDS, frequencia: "3x/semana", duracaoPorNivel: "1 mês e meio", aulasPorNivel: 18, minimoAbrir: 4 },
  ];
  const modalidades: Record<string, string> = {};
  for (const m of modalidadesData) {
    const mod = await prisma.modalidade.create({ data: m });
    modalidades[m.nome] = mod.id;
  }

  // Produtos = idioma × modalidade
  const produtos: Record<string, string> = {};
  for (const nome of Object.keys(modalidades)) {
    const prod = await prisma.produto.create({
      data: { idiomaId: portugues.id, modalidadeId: modalidades[nome] },
    });
    produtos[nome] = prod.id;
  }

  // Disponibilidade por país (ProdutoPais) — todos os produtos ofertados nos 3 países
  for (const cod of Object.keys(paises)) {
    for (const nome of Object.keys(produtos)) {
      await prisma.produtoPais.create({
        data: { produtoId: produtos[nome], paisId: paises[cod].id, moeda: paises[cod].moeda, oferecido: true },
      });
    }
  }

  // PrecoReferencia (EXEMPLOS doc 04). Mensalidade do Regular + taxa de matrícula.
  // Mensalidade documentada: CR ₡25.000 · PA US$50 · SV US$30. Taxa = placeholder (P5).
  const precos: Record<string, { mensalidade: number; matricula: number }> = {
    CR: { mensalidade: 25000, matricula: 20000 },
    PA: { mensalidade: 50, matricula: 40 },
    SV: { mensalidade: 30, matricula: 25 },
  };
  for (const cod of Object.keys(precos)) {
    const base = { paisId: paises[cod].id, produtoId: produtos["Regular"], modalidadeId: modalidades["Regular"], moeda: paises[cod].moeda };
    await prisma.precoReferencia.createMany({
      data: [
        { ...base, tipoCobranca: TipoCobranca.MENSALIDADE, valor: precos[cod].mensalidade, versaoEstudo: "exemplo-doc04" },
        { ...base, tipoCobranca: TipoCobranca.MATRICULA, valor: precos[cod].matricula, versaoEstudo: "placeholder-P5" },
      ],
    });
  }

  console.log(`Catálogo: ${paisesData.length} países · 1 idioma · ${niveis.length} níveis · ${modalidadesData.length} modalidades · preços de exemplo.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
