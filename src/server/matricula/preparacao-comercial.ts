"use server";
import { AgendaParticularSchema, conferirAgendaParticularTx } from "./agenda-particular-estado";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { conferirTurmaParaReserva } from "./reserva-disponibilidade";
import { CadastroInicialSchema, PreparacaoComercialSchema, prepararContratacaoTx } from "./preparacao-comercial-tx";

const papeis: Papel[] = [Papel.ADMINISTRADOR, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA];
async function leadAutorizado(tx: Prisma.TransactionClient, autorId: string, leadId: string) {
  const autor = await tx.usuario.findUnique({ where: { id: autorId }, select: { id: true, nome: true, ativo: true, papeis: true } });
  if (!autor?.ativo || !autor.papeis.some((p) => papeis.includes(p))) throw new ErroPermissao();
  const operacional = autor.papeis.includes(Papel.ADMINISTRADOR) || autor.papeis.includes(Papel.SECRETARIA_ACADEMICA);
  const lead = await tx.lead.findFirst({ where: { AND: [{ id: leadId }, operacional ? {} : await escopoComercialAtual(autor, tx)] }, select: { id: true, nome: true, telefoneE164: true, matricula: { select: { id: true } } } });
  if (!lead) throw new ErroPermissao();
  return lead;
}
function contatoValido(contato: string | null): contato is string { return !!contato && /^\+[1-9]\d{7,14}$/.test(contato); }

/** Correspondência de contato oferece candidatos; não identifica automaticamente uma pessoa. */
export async function consultarCadastrosPreparacao(input: { leadId: string; pagina?: number }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ leadId: z.string().min(1), pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const lead = await leadAutorizado(tx, autor.id, d.leadId);
      const contatoConferivel = contatoValido(lead.telefoneE164);
      const candidatos = contatoConferivel && !lead.matricula ? await tx.aluno.findMany({ where: { telefoneE164: lead.telefoneE164 }, orderBy: [{ primeiroNome: "asc" }, { id: "asc" }], skip: (d.pagina - 1) * 20, take: 21,
        select: { id: true, primeiroNome: true, sobrenome: true } }) : [];
      const podeCadastrarNovo = contatoConferivel && !lead.matricula && !await tx.aluno.count({ where: { telefoneE164: lead.telefoneE164 } });
      const paisesCadastro = podeCadastrarNovo ? await tx.pais.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }) : [];
      return { podeCadastrarNovo, paisesCadastro, lead: { id: lead.id, nome: lead.nome }, matriculaId: lead.matricula?.id ?? null, contatoConferivel, pagina: d.pagina, possuiMais: candidatos.length > 20, candidatos: candidatos.slice(0, 20) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}

const Entrada = PreparacaoComercialSchema.omit({ autorId: true, novoCadastro: true }).extend({ alunoId: z.string().min(1), identidadeConferida: z.literal(true) }).strict();
export async function prepararContratacao(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
    const { identidadeConferida, ...d } = Entrada.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${d.leadId} FOR UPDATE`;
      const lead = await leadAutorizado(tx, autor.id, d.leadId);
      const repetida = await tx.preparacaoComercialMatricula.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } }, select: { id: true } });
      if (repetida) return prepararContratacaoTx(tx, { ...d, autorId: autor.id });
      if (!contatoValido(lead.telefoneE164)) throw new ErroRegra("Confira o contato e a identidade com a Secretaria antes de preparar.");
      await tx.$queryRaw`SELECT id FROM "Aluno" WHERE id = ${d.alunoId} FOR SHARE`;
      const aluno = await tx.aluno.findFirst({ where: { id: d.alunoId, telefoneE164: lead.telefoneE164 }, select: { id: true } });
      if (!aluno) throw new ErroRegra("Cadastro fora dos candidatos desta negociação. Confira a identidade novamente.");
      const resultado = await prepararContratacaoTx(tx, { ...d, autorId: autor.id });
      await registrarEvento(tx, { tipo: "IdentidadeContratacaoSelecionada", agregadoTipo: "Matricula", agregadoId: resultado.matriculaId, autorId: autor.id,
        payload: { leadId: lead.id, alunoId: aluno.id, preparacaoId: resultado.id, identidadeConferida, metodo: "CONTATO_EXATO_SELECAO_EXPLICITA" } });
      return resultado;
    }, { timeout: 20000 });
  });
}

export async function consultarOfertasPreparacao(input: { leadId: string; ofertaId?: string; pagina?: number; paginaTurmas?: number }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ leadId: z.string().min(1), ofertaId: z.string().min(1).optional(), pagina: z.number().int().min(1).max(100000).default(1), paginaTurmas: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await leadAutorizado(tx, autor.id, d.leadId);
      const select = { id: true, produtoId: true, paisId: true, moeda: true, formaAgenda: true, versaoEntrada: true, pais: { select: { nome: true, moedaLocal: true } }, produto: { select: { idiomaId: true, modalidadeId: true, idioma: { select: { nome: true } }, modalidade: { select: { nome: true } } } } } as const;
      const ofertas = await tx.produtoPais.findMany({ where: { oferecido: true, pais: { status: "ATIVO" } }, orderBy: { id: "asc" }, skip: (d.pagina - 1) * 20, take: 21, select });
      const selecionada = d.ofertaId ? await tx.produtoPais.findFirst({ where: { id: d.ofertaId, oferecido: true, pais: { status: "ATIVO" } }, select }) : null;
      if (d.ofertaId && !selecionada) throw new ErroRegra("A oferta escolhida não está disponível. Selecione outra oferta.");
      const configuracao = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { prazoReservaMinutos: true } });
      const turmas = selecionada && !selecionada.formaAgenda?.startsWith("PARTICULAR_") ? await tx.turma.findMany({ where: { modalidadeId: selecionada.produto.modalidadeId, nivel: { idiomaId: selecionada.produto.idiomaId }, status: { not: "CONCLUIDA" } }, orderBy: [{ codigo: "asc" }, { id: "asc" }], skip: (d.paginaTurmas - 1) * 10, take: 11, select: { id: true, codigo: true, nome: true, capacidade: true, status: true } }) : [];
      const registros = [];
      for (const turma of turmas.slice(0, 10)) {
        const { conferencia } = await conferirTurmaParaReserva(tx, turma);
        registros.push({ id: turma.id, nome: turma.codigo ?? turma.nome ?? "Turma sem código", elegivel: conferencia.elegivel, vagas: conferencia.vagas, impedimentos: conferencia.impedimentos });
      }
      const projetar = (o: NonNullable<typeof selecionada>) => ({ id: o.id, formaAgenda: o.formaAgenda, versaoEntrada: o.versaoEntrada, produtoId: o.produtoId, paisId: o.paisId, moeda: o.moeda, moedaCoerente: o.moeda === o.pais.moedaLocal, nome: `${o.produto.idioma.nome} · ${o.produto.modalidade.nome} · ${o.pais.nome}` });
      return { ofertas: ofertas.slice(0, 20).map(projetar), selecionada: selecionada ? projetar(selecionada) : null, pagina: d.pagina, possuiMais: ofertas.length > 20,
        turmas: registros, paginaTurmas: d.paginaTurmas, possuiMaisTurmas: turmas.length > 10, prazoMinutos: configuracao?.prazoReservaMinutos ?? null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 });
  });
}

const EntradaNovaPessoa = PreparacaoComercialSchema.omit({ autorId: true, alunoId: true }).extend({ novoCadastro: CadastroInicialSchema, cadastroNovoConferido: z.literal(true) }).strict();
export async function prepararContratacaoNovaPessoa(input: z.input<typeof EntradaNovaPessoa>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
    const { cadastroNovoConferido, ...d } = EntradaNovaPessoa.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${d.leadId} FOR UPDATE`;
      await leadAutorizado(tx, autor.id, d.leadId);
      const existente = await tx.preparacaoComercialMatricula.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } }, select: { id: true } });
      const resultado = await prepararContratacaoTx(tx, { ...d, autorId: autor.id });
      if (!existente) await registrarEvento(tx, { tipo: "CadastroInicialContratacaoCriado", agregadoTipo: "Matricula", agregadoId: resultado.matriculaId, autorId: autor.id, payload: { preparacaoId: resultado.id, cadastroNovoConferido } });
      return resultado;
    }, { timeout: 20000 });
  });
}


export async function consultarProfessoresParticular(input: { leadId: string; busca?: string; pagina?: number }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ leadId: z.string().min(1), busca: z.string().trim().max(100).default(""), pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const lead = await leadAutorizado(tx, autor.id, d.leadId);
      if (lead.matricula) throw new ErroRegra("Negociação já possui contratação.");
      const professores = await tx.usuario.findMany({ where: { ativo: true, papeis: { has: "PROFESSOR" }, ...(d.busca ? { nome: { contains: d.busca, mode: "insensitive" } } : {}) }, orderBy: [{ nome: "asc" }, { id: "asc" }], skip: (d.pagina - 1) * 20, take: 21, select: { id: true, nome: true } });
      return { professores: professores.slice(0, 20), possuiMais: professores.length > 20, pagina: d.pagina };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}

const RevisaoParticular = AgendaParticularSchema.extend({ leadId: z.string().min(1) }).strict();
export async function revisarAgendaParticularComercial(input: z.input<typeof RevisaoParticular>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
    const { leadId, ...agenda } = RevisaoParticular.parse(input);
    return prisma.$transaction(async (tx) => {
      const lead = await leadAutorizado(tx, autor.id, leadId);
      if (lead.matricula) throw new ErroRegra("Negociação já possui contratação.");
      const r = await conferirAgendaParticularTx(tx, agenda);
      // Não expor os identificadores de outras matrículas, reservas ou aulas à carteira comercial.
      return { estadoHash: r.estadoHash, conferidoEm: r.conferidoEm, formaAgenda: r.snapshot.formaAgenda, impedimentos: r.snapshot.impedimentos,
        encontros: r.snapshot.encontros.map((e) => ({ indice: e.indice, inicio: e.inicio, fim: e.fim,
          conflito: r.snapshot.conflitos.some((c) => c.indice === e.indice) || r.snapshot.reservasConflitantes.some((c) => c.indice === e.indice),
          docenteIndisponivel: r.snapshot.indisponibilidades.some((c) => c.indice === e.indice), naoLetivo: !!e.periodosNaoLetivos.length })), reservaEfetuada: false as const };
    }, { timeout: 20000 });
  });
}
