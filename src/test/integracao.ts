import { Prisma, Papel, StatusPais, TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inicioDoDiaInstitucional } from "@/server/operacao/fuso";
import { fusoDaEscola } from "@/server/relatorios/atendimento";

export async function truncarBanco(): Promise<void> {
  const tabelas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations')
  `;
  if (tabelas.length === 0) return;
  const lista = tabelas.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
}

export async function configurarFusoDaEscola(fuso = "UTC"): Promise<void> {
  await prisma.configuracaoOperacional.upsert({
    where: { id: "escola" },
    create: { id: "escola", fusoInstitucional: fuso },
    update: { fusoInstitucional: fuso },
  });
}

export async function meioDiaDaEscolaHoje(): Promise<Date> {
  return new Date(inicioDoDiaInstitucional(new Date(), await fusoDaEscola()).getTime() + 12 * 3600_000);
}

let seqUsuario = 0;

export async function criarUsuario(papeis: Papel[], nome = "Usuário Teste") {
  seqUsuario += 1;
  return prisma.usuario.create({
    data: {
      nome,
      email: `teste-${Date.now()}-${seqUsuario}@genius.test`,
      senhaHash: "x",
      papeis,
    },
  });
}

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

export async function eventosDo(agregadoTipo: string, agregadoId: string) {
  return prisma.evento.findMany({
    where: { agregadoTipo, agregadoId },
    orderBy: { criadoEm: "asc" },
  });
}

export async function criarAlunoMinimo(extra: Partial<Prisma.AlunoUncheckedCreateInput> = {}) {
  const pais =
    (await prisma.pais.findFirst({ where: { codigoISO: "CR" } })) ??
    (await prisma.pais.create({
      data: { nome: "Costa Rica", codigoISO: "CR", moedaLocal: "CRC", ddi: "+506", status: StatusPais.ATIVO },
    }));
  return prisma.aluno.create({ data: { primeiroNome: "Aluno", paisId: pais.id, ...extra } });
}
