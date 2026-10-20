import { Prisma, Papel, StatusPais, TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inicioDoDiaInstitucional } from "@/server/operacao/fuso";
import { fusoDaEscola } from "@/server/relatorios/atendimento";

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

/**
 * Fuso da escola configurado (D10): sem ele, o lançamento de avaliação é recusado. As suítes que lançam notas
 * chamam isto no setup, depois do truncarBanco. Upsert: chamar de novo (ou depois de outra configuração) só
 * reafirma o fuso.
 */
export async function configurarFusoDaEscola(fuso = "UTC"): Promise<void> {
  await prisma.configuracaoOperacional.upsert({
    where: { id: "escola" },
    create: { id: "escola", fusoInstitucional: fuso },
    update: { fusoInstitucional: fuso },
  });
}

/**
 * Meio-dia da escola no dia corrente (revisão da #255, C1). Serve de relógio fixo para as suítes que
 * precisam do dia da máquina igual ao da escola: ao contrário de uma data literal, fica no mesmo dia do
 * `now()` do Postgres (`criadoEm` etc.), que segue o relógio real. Ler com o relógio real, antes de
 * `vi.setSystemTime`, e depois do `truncarBanco` (o fuso vem da configuração, ou do padrão).
 */
export async function meioDiaDaEscolaHoje(): Promise<Date> {
  return new Date(inicioDoDiaInstitucional(new Date(), await fusoDaEscola()).getTime() + 12 * 3600_000);
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

/**
 * Aluno mínimo (país próprio criado sob demanda, reaproveitado se já existir).
 * `extra` sobrescreve/complementa os campos (ex.: `pessoaId`).
 */
export async function criarAlunoMinimo(extra: Partial<Prisma.AlunoUncheckedCreateInput> = {}) {
  const pais =
    (await prisma.pais.findFirst({ where: { codigoISO: "CR" } })) ??
    (await prisma.pais.create({
      data: { nome: "Costa Rica", codigoISO: "CR", moedaLocal: "CRC", ddi: "+506", status: StatusPais.ATIVO },
    }));
  return prisma.aluno.create({ data: { primeiroNome: "Aluno", paisId: pais.id, ...extra } });
}
