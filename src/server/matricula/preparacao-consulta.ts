"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { limitesAtuais, exigeAprovacaoComponente } from "@/server/financeiro/politica";
import { ConferenciaAlcadaSchema } from "./alcada-preparacao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { resolverReservaParticularAtual } from "./reserva-particular-cadeia";

const Referencias = z.object({ adiantamentoProposto: z.object({ minutos: z.number().int().positive(), unidadeMinutos: z.literal(60), valorHora: z.string(), valor: z.string(), arredondamento: z.literal("MONETARIO_2_CASAS_HALF_UP") }).nullable().optional(), politicaEntrada: z.object({ formaAgenda: z.enum(["TURMA", "PARTICULAR_GRADE_FIXA", "PARTICULAR_FLEXIVEL"]).nullable().optional(), exigirPrimeiraMensalidade: z.boolean().nullable().optional(), versao: z.number().int().nonnegative(), taxaPreviaAssinatura: z.boolean().nullable(), adiantamentoHoraExigido: z.boolean().nullable() }).optional(), exigeDirecao: z.boolean().default(true), alcada: ConferenciaAlcadaSchema.optional(), precos: z.array(z.object({ tipoCobranca: z.enum(["MATRICULA", "MENSALIDADE", "HORA_PARTICULAR"]), valor: z.string().regex(/^\d+(?:\.\d{1,2})?$/), moeda: z.string().min(1) })) });
export async function consultarPreparacaoContratacao(input: { matriculaId: string }) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ matriculaId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const autor = await tx.usuario.findUnique({ where: { id: sessao.id }, select: { id: true, nome: true, ativo: true, papeis: true } });
      const papeis: Papel[] = [Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL];
      if (!autor?.ativo || !autor.papeis.some((p) => papeis.includes(p))) throw new ErroPermissao();
      const secretaria = autor.papeis.includes(Papel.ADMINISTRADOR) || autor.papeis.includes(Papel.SECRETARIA_ACADEMICA);
      const m = await tx.matricula.findFirst({ where: { id: d.matriculaId, ...(!secretaria ? { lead: { is: await escopoComercialAtual(autor, tx) } } : {}) },
        select: { leadId: true, id: true, codigo: true, status: true, secretariaAssumiuEm: true, confirmacaoContratoEm: true,
          aluno: { select: { primeiroNome: true, sobrenome: true } }, produto: { select: { idioma: { select: { nome: true } }, modalidade: { select: { nome: true } } } }, pais: { select: { nome: true } },
          preparacaoComercial: { select: { decisaoPreco: { select: { aprovada: true, motivo: true, decididaEm: true, decisor: { select: { nome: true } } } }, preparadorId: true, id: true, regime: true, taxaProposta: true, valorServicoProposto: true, moeda: true, motivo: true, criadaEm: true, referencias: true,
            preparador: { select: { nome: true } }, reservaParticular: { select: { id: true, status: true, expiraEm: true, horarios: { orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, inicio: true, fim: true, fusoOrigem: true, professor: { select: { nome: true } } } } } }, reserva: { select: { status: true, expiraEm: true, turma: { select: { codigo: true, nome: true } }, janela: { select: { fusoAdmissao: true } } } } } } } });
      if (!m) throw new ErroRegra("Contratação não encontrada ou fora do acesso permitido.");
      const { preparacaoComercial: p, leadId, ...matricula } = m;
      if (!p) return { matricula, preparacao: null };
      const referencias = Referencias.safeParse(p.referencias);
      const { referencias: descartadas, preparadorId, taxaProposta, valorServicoProposto, ...visivel } = p;
      const reservaParticularOriginal = p.reservaParticular ? { id: p.reservaParticular.id, status: p.reservaParticular.status } : null;
      if (p.reservaParticular) {
        const atualId = await resolverReservaParticularAtual(tx, p.reservaParticular.id);
        if (atualId !== p.reservaParticular.id) visivel.reservaParticular = await tx.reservaAgendaParticular.findFirst({ where: { id: atualId, matriculaId: m.id },
          select: { id: true, status: true, expiraEm: true, horarios: { orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, inicio: true, fim: true, fusoOrigem: true, professor: { select: { nome: true } } } } } });
      }
      void descartadas;
      const admin = autor.papeis.includes(Papel.ADMINISTRADOR);
      const gerente = autor.papeis.includes(Papel.GERENTE_COMERCIAL);
      const escopoDecisao = admin || !!(gerente && leadId && await tx.lead.findFirst({ where: { AND: [{ id: leadId }, await escopoComercialAtual(autor, tx)] }, select: { id: true } }));
      const alcada = referencias.success ? referencias.data.alcada : undefined;
      let impedimento = p.decisaoPreco ? "A exceção já foi decidida." : !["RASCUNHO", "AGUARDANDO"].includes(m.status) ? "A matrícula não está em preparação." : !alcada ? "A análise de alçada precisa ser conferida." : alcada.componentes.every((c) => c.resultado === "DENTRO_ALCADA") ? "O preço proposto não exige exceção de alçada." : preparadorId === autor.id ? "Outra pessoa autorizada deve decidir." : !escopoDecisao ? "Aguardando decisão comercial autorizada." : referencias.success && referencias.data.exigeDirecao && !admin ? "Esta proposta exige decisão da Administração." : null;
      const podeRejeitar = impedimento === null;
      let podeAprovar = podeRejeitar;
      if (podeAprovar && !admin && alcada) {
        const limites = await limitesAtuais(tx, autor);
        if ((limites.alcadaAlteradaEm && limites.alcadaAlteradaEm > p.criadaEm) || alcada.componentes.some((c) => c.referencia === null || c.resultado === "REFERENCIA_INSUFICIENTE" || exigeAprovacaoComponente(limites, c.tipo, c.referencia, c.proposto))) {
          podeAprovar = false; impedimento = "A aprovação exige a Administração: confira a referência e a alçada aplicável.";
        }
      }
      return { matricula, preparacao: { ...visivel, reservaParticularOriginal, decisaoDisponivel: { podeAprovar, podeRejeitar, impedimento }, taxaProposta: taxaProposta.toString(), valorServicoProposto: valorServicoProposto.toString(),
        adiantamentoProposto: referencias.success ? referencias.data.adiantamentoProposto ?? null : null, politicaEntrada: referencias.success ? referencias.data.politicaEntrada ?? null : null, alcada: referencias.success ? referencias.data.alcada ?? null : null, referenciasConferiveis: referencias.success, precosReferencia: referencias.success ? referencias.data.precos : [], condicoesAprovadas: false as const } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
