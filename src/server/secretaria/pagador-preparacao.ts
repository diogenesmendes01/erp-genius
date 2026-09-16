"use server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";

const Dados = z.object({ nome: z.string().trim().min(1).max(200), paisId: z.string().min(1), documento: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(254).optional(), telefoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(), endereco: z.string().trim().max(1000).optional() }).strict();
const Entrada = z.object({ matriculaId: z.string().min(1), versaoEsperada: z.number().int().nonnegative(),
  pagador: z.discriminatedUnion("tipo", [z.object({ tipo: z.literal("ALUNO") }).strict(), z.object({ tipo: z.enum(["RESPONSAVEL", "EMPRESA"]), dados: Dados }).strict()]),
  motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();

export async function registrarPagadorPreparacao(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = Entrada.parse(input);
    const hash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${d.matriculaId} FOR UPDATE`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const repetido = await tx.pagadorPreparacaoMatricula.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetido) {
        if (repetido.entradaHash !== hash) throw new ErroRegra("Chave já utilizada para outro registro de pagador.");
        return { id: repetido.id, versao: repetido.versao };
      }
      const m = await tx.matricula.findUnique({ where: { id: d.matriculaId }, select: { alunoId: true, status: true, secretariaAssumiuEm: true, contratoOk: true, confirmacaoContratoEm: true, preparacaoComercial: { select: { id: true } } } });
      if (!m?.preparacaoComercial || !m.secretariaAssumiuEm || !["RASCUNHO", "AGUARDANDO"].includes(m.status)) throw new ErroRegra("Assuma a matrícula em preparação antes de registrar o pagador.");
      if (m.contratoOk || m.confirmacaoContratoEm || await tx.cobranca.count({ where: { matriculaId: d.matriculaId } })) throw new ErroRegra("Contratação com aceite ou cobrança exige revisão documental/financeira do pagador.");
      const ultimo = await tx.pagadorPreparacaoMatricula.findFirst({ where: { matriculaId: d.matriculaId }, orderBy: { versao: "desc" }, select: { versao: true } });
      if ((ultimo?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("O pagador mudou desde a consulta. Atualize e confira novamente.");
      let dados;
      if (d.pagador.tipo === "ALUNO") {
        await tx.$queryRaw`SELECT id FROM "Aluno" WHERE id = ${m.alunoId} FOR SHARE`;
        const a = await tx.aluno.findUniqueOrThrow({ where: { id: m.alunoId }, select: { id: true, primeiroNome: true, sobrenome: true, paisId: true, documento: true, email: true, telefoneE164: true, paisResidencia: true, rua: true, numero: true, complemento: true, bairro: true, cidade: true, regiao: true, cep: true } });
        dados = { alunoId: a.id, nome: [a.primeiroNome, a.sobrenome].filter(Boolean).join(" "), paisId: a.paisId, documento: a.documento, email: a.email, telefoneE164: a.telefoneE164,
          endereco: [a.rua, a.numero, a.complemento, a.bairro, a.cidade, a.regiao, a.cep, a.paisResidencia].filter(Boolean).join(", ") };
      } else {
        if (!await tx.pais.findUnique({ where: { id: d.pagador.dados.paisId }, select: { id: true } })) throw new ErroRegra("País do pagador não encontrado.");
        dados = d.pagador.dados;
      }
      const p = await tx.pagadorPreparacaoMatricula.create({ data: { matriculaId: d.matriculaId, preparadorId: autor.id, versao: d.versaoEsperada + 1, tipo: d.pagador.tipo, dados, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash } });
      await registrarEvento(tx, { tipo: "PagadorPreparacaoRegistrado", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { pagadorRegistroId: p.id, versao: p.versao, tipo: p.tipo, motivo: d.motivo } });
      return { id: p.id, versao: p.versao };
    });
  });
}

export async function consultarPagadorPreparacao(matriculaId: string) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO);
    z.string().min(1).parse(matriculaId);
    return prisma.pagadorPreparacaoMatricula.findFirst({ where: { matriculaId }, orderBy: { versao: "desc" }, select: {
      id: true, versao: true, tipo: true, dados: true, motivo: true, criadaEm: true, preparador: { select: { nome: true } },
    } });
  });
}

export async function consultarTelaPagador(matriculaId: string) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO);
    z.string().min(1).parse(matriculaId);
    return prisma.$transaction(async (tx) => {
      const m = await tx.matricula.findUnique({ where: { id: matriculaId }, select: { id: true, codigo: true, status: true, secretariaAssumiuEm: true, contratoOk: true, confirmacaoContratoEm: true,
        aluno: { select: { primeiroNome: true, sobrenome: true } }, preparacaoComercial: { select: { id: true } }, _count: { select: { cobrancas: true } },
        pagadoresPreparacao: { orderBy: { versao: "desc" }, take: 1, select: { id: true, versao: true, tipo: true, dados: true, motivo: true, preparador: { select: { nome: true } } } } } });
      if (!m) throw new ErroRegra("Matrícula não encontrada.");
      const editar = autor.papeis.includes(Papel.SECRETARIA_ACADEMICA) || autor.papeis.includes(Papel.ADMINISTRADOR);
      const impedimento = !editar ? "Consulta do Financeiro; a Secretaria prepara o cadastro." : !m.preparacaoComercial ? "Esta matrícula ainda não possui preparação comercial." : !m.secretariaAssumiuEm ? "Assuma a matrícula na Secretaria antes de registrar o pagador." : !["RASCUNHO", "AGUARDANDO"].includes(m.status) || m.contratoOk || m.confirmacaoContratoEm || m._count.cobrancas ? "Alterações exigem revisão documental/financeira da contratação." : null;
      const registro = m.pagadoresPreparacao[0];
      const dados = registro ? z.object({ nome: z.string(), paisId: z.string(), documento: z.string().nullable().optional(), email: z.string().nullable().optional(), telefoneE164: z.string().nullable().optional(), endereco: z.string().nullable().optional() }).parse(registro.dados) : null;
      return { matricula: { id: m.id, codigo: m.codigo, aluno: m.aluno }, impedimento, podeEditar: impedimento === null,
        registro: registro ? { id: registro.id, versao: registro.versao, tipo: registro.tipo, motivo: registro.motivo, preparador: registro.preparador, dados: dados! } : null,
        paises: impedimento === null ? await tx.pais.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }) : [] };
    }, { isolationLevel: "RepeatableRead" });
  });
}

export async function consultarHistoricoPagador(input: { matriculaId: string; pagina?: number }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO);
    const d = z.object({ matriculaId: z.string().min(1), pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    const registros = await prisma.pagadorPreparacaoMatricula.findMany({ where: { matriculaId: d.matriculaId }, orderBy: { versao: "desc" }, skip: (d.pagina - 1) * 20, take: 21,
      select: { id: true, versao: true, tipo: true, dados: true, motivo: true, criadaEm: true, preparador: { select: { nome: true } } } });
    return { pagina: d.pagina, temProxima: registros.length > 20, registros: registros.slice(0, 20).map((r) => ({ ...r,
      dados: z.object({ nome: z.string(), paisId: z.string(), documento: z.string().nullable().optional(), email: z.string().nullable().optional(), telefoneE164: z.string().nullable().optional(), endereco: z.string().nullable().optional() }).parse(r.dados) })) };
  });
}
