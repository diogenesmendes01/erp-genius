"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { resolverReservaParticularAtual } from "./reserva-particular-cadeia";
import { criarNovaReservaParticularTx, revisarNovaReservaParticularTx, NovaReservaParticularSchema } from "./nova-reserva-particular-tx";
import { planejarCobrancasEntrada } from "./plano-cobrancas-entrada";

export async function revisarNovaReservaParticular(input: z.input<typeof NovaReservaParticularSchema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = NovaReservaParticularSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      const r = await revisarNovaReservaParticularTx(tx, d, autor.id);
      const { aluno, pagador, condicoes, cobrancas, agenda } = r.snapshot;
      return { revisaoHash: r.revisaoHash, aluno, pagador: { tipo: pagador.tipo, versao: pagador.versao, dados: z.object({ nome: z.string(), documento: z.string().nullable().optional(), email: z.string().nullable().optional(), telefoneE164: z.string().nullable().optional(), endereco: z.string().nullable().optional() }).parse(pagador.dados) },
        versaoCondicoes: condicoes.versao, plano: planejarCobrancasEntrada(condicoes.dados),
        cobrancas: cobrancas.map(({ informes, recebimentos, ...c }) => ({ ...c, valorNegociado: c.valorNegociado.toString(), valorRecebido: c.valorRecebido?.toString() ?? null, saldo: c.saldo?.toString() ?? null, informesPendentes: informes.filter((i) => i.status === "A_CONFERIR").length, recebimentosRegistrados: recebimentos.length })),
        agenda: { forma: agenda.formaAgenda, fuso: agenda.fusoOrigem, encontros: agenda.encontros.map((e) => ({ inicio: e.inicio, fim: e.fim })) },
      };
    }, { timeout: 20000 });
  });
}

const Confirmar = NovaReservaParticularSchema.extend({ revisaoHash: z.string().regex(/^[a-f0-9]{64}$/), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100), dadosConferidos: z.literal(true) }).strict();
export async function confirmarNovaReservaParticular(input: z.input<typeof Confirmar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = Confirmar.parse(input);
    return prisma.$transaction((tx) => criarNovaReservaParticularTx(tx, { ...d, autorId: autor.id }), { timeout: 20000 });
  });
}

export async function consultarFormularioNovaReserva(input: { matriculaId: string; buscaProfessor?: string; pagina?: number }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ matriculaId: z.string().min(1), buscaProfessor: z.string().trim().max(100).default(""), pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => p === "ADMINISTRADOR" || p === "SECRETARIA_ACADEMICA")) throw new ErroPermissao();
      const m = await tx.matricula.findUnique({ where: { id: d.matriculaId }, select: { status: true, secretariaAssumiuEm: true, produtoId: true, paisId: true, preparacaoComercial: { select: { reservaParticularId: true } } } });
      if (!m?.preparacaoComercial?.reservaParticularId || !m.secretariaAssumiuEm || !["RASCUNHO", "AGUARDANDO"].includes(m.status)) throw new ErroRegra("Confira a preparação assumida pela Secretaria.");
      const anteriorId = await resolverReservaParticularAtual(tx, m.preparacaoComercial.reservaParticularId);
      const anterior = await tx.reservaAgendaParticular.findUniqueOrThrow({ where: { id: anteriorId } });
      if (!["EXPIRADA", "LIBERADA"].includes(anterior.status)) throw new ErroRegra("A reserva atual ainda não foi encerrada.");
      const oferta = await tx.produtoPais.findFirst({ where: { produtoId: m.produtoId, paisId: m.paisId, oferecido: true }, select: { id: true, versaoEntrada: true, formaAgenda: true } });
      const origem = z.object({ formaAgenda: z.enum(["PARTICULAR_GRADE_FIXA", "PARTICULAR_FLEXIVEL"]), fusoOrigem: z.string() }).parse(anterior.snapshot);
      if (!oferta || oferta.formaAgenda !== origem.formaAgenda) throw new ErroRegra("Confira a oferta e a forma de agenda contratada.");
      const professores = await tx.usuario.findMany({ where: { ativo: true, papeis: { has: "PROFESSOR" }, ...(d.buscaProfessor ? { nome: { contains: d.buscaProfessor, mode: "insensitive" as const } } : {}) }, orderBy: [{ nome: "asc" }, { id: "asc" }], skip: (d.pagina - 1) * 30, take: 31, select: { id: true, nome: true } });
      return { matriculaId: d.matriculaId, anteriorId, ofertaId: oferta.id, versaoOferta: oferta.versaoEntrada, formaAgenda: origem.formaAgenda, fuso: origem.fusoOrigem,
        professores: professores.slice(0, 30), pagina: d.pagina, temProxima: professores.length > 30 };
    }, { isolationLevel: "RepeatableRead" });
  });
}
