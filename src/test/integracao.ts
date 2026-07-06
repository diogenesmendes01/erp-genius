import { Papel, StatusPais, TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Helpers das suites de integração (*.int.test.ts). O banco é o Postgres de TESTE
// (a URL é injetada pelo vitest.integration.config — nunca o .env/produção).

/** Limpa TODAS as tabelas do domínio (ordem irrelevante: TRUNCATE ... CASCADE). */
export async function truncarBanco(): Promise<void> {
  const tabelas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations')
  `;
  if (tabelas.length === 0) return;
  const lista = tabelas.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
}

let seqUsuario = 0;

/** Cria um usuário REAL no banco de teste (papéis frescos são lidos daqui). */
export async function criarUsuario(papeis: Papel[], nome = "Usuário Teste") {
  seqUsuario += 1;
  return prisma.usuario.create({
    data: {
      nome,
      email: `teste-${Date.now()}-${seqUsuario}@genius.test`,
      senhaHash: "x", // nunca autentica por senha nos testes (sessão é mockada)
      papeis,
    },
  });
}

/**
 * Catálogo mínimo para o fluxo de matrícula: país ativo (CR) + idioma + modalidade +
 * produto oferecido no país + preços ativos de taxa e mensalidade + tipo de documento.
 */
export async function seedCatalogoMinimo() {
  const pais = await prisma.pais.create({
    data: {
      nome: "Costa Rica",
      codigoISO: "CR",
      moedaLocal: "CRC",
      ddi: "+506",
      status: StatusPais.ATIVO,
      tiposDocumento: { create: { nome: "Cédula", validador: "cedula_cr" } },
    },
    include: { tiposDocumento: true },
  });
  const idioma = await prisma.idioma.create({ data: { nome: "Português" } });
  const modalidade = await prisma.modalidade.create({
    data: { nome: "Regular", frequencia: "2x/semana", duracaoPorNivel: "3 meses" },
  });
  const produto = await prisma.produto.create({
    data: { idiomaId: idioma.id, modalidadeId: modalidade.id },
  });
  await prisma.produtoPais.create({
    data: { produtoId: produto.id, paisId: pais.id, moeda: "CRC", oferecido: true },
  });
  const precoTaxa = await prisma.precoReferencia.create({
    data: {
      paisId: pais.id,
      produtoId: produto.id,
      modalidadeId: modalidade.id,
      tipoCobranca: TipoCobranca.MATRICULA,
      valor: 20000,
      moeda: "CRC",
    },
  });
  const precoMensalidade = await prisma.precoReferencia.create({
    data: {
      paisId: pais.id,
      produtoId: produto.id,
      modalidadeId: modalidade.id,
      tipoCobranca: TipoCobranca.MENSALIDADE,
      valor: 85000,
      moeda: "CRC",
    },
  });
  return { pais, idioma, modalidade, produto, precoTaxa, precoMensalidade };
}

/** Eventos gravados para um agregado, mais recentes por último. */
export async function eventosDo(agregadoTipo: string, agregadoId: string) {
  return prisma.evento.findMany({
    where: { agregadoTipo, agregadoId },
    orderBy: { criadoEm: "asc" },
  });
}
