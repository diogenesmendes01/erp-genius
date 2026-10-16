import { EtapaLead, OrigemCanal, Papel, type CorTag, type Prisma, type Temperatura } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { palavrasDaBuscaLeads } from "@/server/comercial/filtros";
import { escopoPessoas } from "./pessoas";

export const CONTATOS_POR_PAGINA = 50;

export type FiltrosContatos = {
  busca: string;
  tipo: "todos" | "pessoas" | "empresas";
  tagId: string;
  donoId: string;
  etapa: EtapaLead | "";
  origem: OrigemCanal | "";
  pagina: number;
};

export type LinhaContato = {
  id: string;
  tipo: "pessoa" | "empresa";
  nome: string;
  subtitulo: string | null;
  telefone: string | null;
  tags: { id: string; nome: string; cor: CorTag }[];
  oportunidade: { id: string; etapa: EtapaLead; temperatura: Temperatura; dono: string | null } | null;
  optOut: boolean;
  ultimaInteracaoEm: Date | null;
};

type Params = Record<string, string | string[] | undefined>;

function um(p: Params, chave: string): string {
  const v = p[chave];
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" ? s.trim() : "";
}

const noEnum = <T extends string>(valor: string, enumObj: Record<string, T>): T | "" =>
  (Object.values(enumObj) as string[]).includes(valor) ? (valor as T) : "";

export function lerFiltrosContatos(p: Params): FiltrosContatos {
  const tipo = um(p, "tipo");
  const pagina = Number.parseInt(um(p, "pagina"), 10);
  return {
    busca: um(p, "busca").slice(0, 200),
    tipo: tipo === "pessoas" || tipo === "empresas" ? tipo : "todos",
    tagId: um(p, "tagId"),
    donoId: um(p, "donoId"),
    etapa: noEnum(um(p, "etapa"), EtapaLead),
    origem: noEnum(um(p, "origem"), OrigemCanal),
    pagina: Number.isFinite(pagina) && pagina > 1 ? Math.min(pagina, 10_000) : 1,
  };
}

const ETAPAS_FECHADAS: EtapaLead[] = [EtapaLead.MATRICULADO, EtapaLead.PERDIDO];

function papeisDe(u: UsuarioSessao) {
  const gestao = u.papeis.includes(Papel.ADMINISTRADOR) || u.papeis.includes(Papel.GERENTE_COMERCIAL);
  return { gestao, comercial: gestao || u.papeis.includes(Papel.VENDEDOR) };
}

function filtroOportunidade(f: FiltrosContatos): Prisma.OportunidadeWhereInput | null {
  const cond: Prisma.OportunidadeWhereInput = {};
  if (f.donoId) cond.vendedorDonoId = f.donoId;
  if (f.etapa) cond.etapa = f.etapa;
  return Object.keys(cond).length ? cond : null;
}

function wherePessoas(f: FiltrosContatos, escopo: Prisma.PessoaWhereInput, comercial: boolean): Prisma.PessoaWhereInput {
  const e: Prisma.PessoaWhereInput[] = [escopo];
  const palavras = palavrasDaBuscaLeads(f.busca);
  for (const w of palavras) {
    e.push({
      OR: [
        { nome: { contains: w, mode: "insensitive" } },
        { email: { contains: w, mode: "insensitive" } },
        { codigo: { contains: w, mode: "insensitive" } },
        { contatosWhatsApp: { some: { telefoneE164: { contains: w } } } },
      ],
    });
  }
  if (f.tagId) e.push({ tags: { some: { tagId: f.tagId } } });
  if (f.origem) e.push({ origemCanal: f.origem });
  const op = comercial ? filtroOportunidade(f) : null;
  if (op) e.push({ oportunidades: { some: op } });
  return { AND: e };
}

function whereEmpresas(
  f: FiltrosContatos,
  escopoP: Prisma.PessoaWhereInput,
  escopoO: Prisma.OportunidadeWhereInput,
  gestao: boolean,
  comercial: boolean,
): Prisma.EmpresaWhereInput {
  const visivel: Prisma.EmpresaWhereInput[] = [{ pessoas: { some: escopoP } }];
  if (comercial) visivel.push({ oportunidades: { some: escopoO } });
  if (gestao) visivel.push({ pessoas: { none: {} }, oportunidades: { none: {} } });
  const e: Prisma.EmpresaWhereInput[] = [{ OR: visivel }];
  for (const w of palavrasDaBuscaLeads(f.busca)) {
    e.push({
      OR: [
        { nome: { contains: w, mode: "insensitive" } },
        { codigo: { contains: w, mode: "insensitive" } },
        { contatoNome: { contains: w, mode: "insensitive" } },
        { contatoTelefone: { contains: w } },
      ],
    });
  }
  if (f.tagId) e.push({ tags: { some: { tagId: f.tagId } } });
  if (f.origem) e.push({ origemCanal: f.origem });
  const op = comercial ? filtroOportunidade(f) : null;
  if (op) e.push({ oportunidades: { some: op } });
  return { AND: e };
}

function maximo(a: Date | null, b: Date | null | undefined): Date | null {
  if (!b) return a;
  return !a || b > a ? b : a;
}

/** Lista de Contatos (pessoas e empresas) no escopo do papel. Pessoas primeiro, depois empresas, por nome. */
export async function listarContatos(
  usuario: UsuarioSessao,
  f: FiltrosContatos,
): Promise<{ itens: LinhaContato[]; total: number; possuiMais: boolean }> {
  const { gestao, comercial } = papeisDe(usuario);
  const escopoP = await escopoPessoas(usuario);
  const escopoO = await escopoComercialAtual(usuario);
  const incluiPessoas = f.tipo !== "empresas";
  const incluiEmpresas = f.tipo !== "pessoas";

  const wP = wherePessoas(f, escopoP, comercial);
  const wE = whereEmpresas(f, escopoP, escopoO, gestao, comercial);
  const [totalP, totalE] = await Promise.all([
    incluiPessoas ? prisma.pessoa.count({ where: wP }) : 0,
    incluiEmpresas ? prisma.empresa.count({ where: wE }) : 0,
  ]);
  const total = totalP + totalE;
  const inicio = (f.pagina - 1) * CONTATOS_POR_PAGINA;
  const fim = inicio + CONTATOS_POR_PAGINA;

  const oportunidadeAberta = {
    where: {
      etapa: { notIn: ETAPAS_FECHADAS },
      ...(gestao ? { OR: [escopoO, { vendedorDonoId: null }] } : escopoO),
    },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    take: 1,
    select: { id: true, etapa: true, temperatura: true, vendedor: { select: { nome: true } } },
  } satisfies Prisma.Pessoa$oportunidadesArgs;
  const tagsSel = { select: { tag: { select: { id: true, nome: true, cor: true } } } };

  const linhas: LinhaContato[] = [];
  const idsEventos: { tipo: string; id: string }[] = [];
  const porPessoa = new Map<string, LinhaContato>();
  const porEmpresa = new Map<string, LinhaContato>();

  if (incluiPessoas && inicio < totalP) {
    const pessoas = await prisma.pessoa.findMany({
      where: wP,
      orderBy: [{ nome: "asc" }, { id: "asc" }],
      skip: inicio,
      take: Math.min(CONTATOS_POR_PAGINA, totalP - inicio),
      select: {
        id: true,
        nome: true,
        email: true,
        cargo: true,
        empresa: { select: { nome: true } },
        contatosWhatsApp: { select: { telefoneE164: true, optOutEm: true }, orderBy: { criadoEm: "asc" } },
        tags: tagsSel,
        oportunidades: oportunidadeAberta,
      },
    });
    for (const p of pessoas) {
      const op = comercial ? p.oportunidades[0] : undefined;
      const linha: LinhaContato = {
        id: p.id,
        tipo: "pessoa",
        nome: p.nome,
        subtitulo: [p.cargo, p.empresa?.nome].filter(Boolean).join(" · ") || p.email || null,
        telefone: p.contatosWhatsApp[0]?.telefoneE164 ?? null,
        tags: p.tags.map((t) => t.tag),
        oportunidade: op ? { id: op.id, etapa: op.etapa, temperatura: op.temperatura, dono: op.vendedor?.nome ?? null } : null,
        optOut: p.contatosWhatsApp.some((c) => c.optOutEm),
        ultimaInteracaoEm: null,
      };
      linhas.push(linha);
      porPessoa.set(p.id, linha);
      idsEventos.push({ tipo: "Pessoa", id: p.id });
    }
  }

  if (incluiEmpresas && fim > totalP) {
    const saltar = Math.max(0, inicio - totalP);
    const empresas = await prisma.empresa.findMany({
      where: wE,
      orderBy: [{ nome: "asc" }, { id: "asc" }],
      skip: saltar,
      take: Math.min(CONTATOS_POR_PAGINA - linhas.length, totalE - saltar),
      select: {
        id: true,
        nome: true,
        contatoNome: true,
        contatoTelefone: true,
        segmentoMercado: true,
        tags: tagsSel,
        oportunidades: oportunidadeAberta,
      },
    });
    for (const e of empresas) {
      const op = comercial ? e.oportunidades[0] : undefined;
      const linha: LinhaContato = {
        id: e.id,
        tipo: "empresa",
        nome: e.nome,
        subtitulo: e.contatoNome ?? e.segmentoMercado ?? null,
        telefone: e.contatoTelefone ?? null,
        tags: e.tags.map((t) => t.tag),
        oportunidade: op ? { id: op.id, etapa: op.etapa, temperatura: op.temperatura, dono: op.vendedor?.nome ?? null } : null,
        optOut: false,
        ultimaInteracaoEm: null,
      };
      linhas.push(linha);
      porEmpresa.set(e.id, linha);
      idsEventos.push({ tipo: "Empresa", id: e.id });
    }
  }

  // Última interação: maior Evento.criadoEm da pessoa e das oportunidades dela (só quem enxerga o comercial).
  if (linhas.length) {
    const pessoaIds = [...porPessoa.keys()];
    const empresaIds = [...porEmpresa.keys()];
    const ops = comercial
      ? await prisma.oportunidade.findMany({
          where: {
            AND: [
              escopoO,
              { OR: [{ pessoaId: { in: pessoaIds } }, { empresaId: { in: empresaIds } }] },
            ],
          },
          select: { id: true, pessoaId: true, empresaId: true },
        })
      : [];
    const opIds = ops.map((o) => o.id);
    const eventos = await prisma.evento.groupBy({
      by: ["agregadoTipo", "agregadoId"],
      where: {
        OR: [
          { agregadoTipo: "Pessoa", agregadoId: { in: pessoaIds } },
          ...(empresaIds.length ? [{ agregadoTipo: "Empresa", agregadoId: { in: empresaIds } }] : []),
          ...(opIds.length ? [{ agregadoTipo: "Lead", agregadoId: { in: opIds } }] : []),
        ],
      },
      _max: { criadoEm: true },
    });
    const maxPor = new Map(eventos.map((e) => [`${e.agregadoTipo}:${e.agregadoId}`, e._max.criadoEm]));
    for (const l of linhas) {
      l.ultimaInteracaoEm = maximo(null, maxPor.get(`${l.tipo === "pessoa" ? "Pessoa" : "Empresa"}:${l.id}`));
    }
    for (const o of ops) {
      const alvo = (o.pessoaId && porPessoa.get(o.pessoaId)) || (o.empresaId && porEmpresa.get(o.empresaId)) || null;
      if (alvo) alvo.ultimaInteracaoEm = maximo(alvo.ultimaInteracaoEm, maxPor.get(`Lead:${o.id}`));
      // Oportunidade de empresa com pessoa também conta para a pessoa; a de pessoa conta para a empresa dela só se listada.
      if (o.pessoaId && o.empresaId) {
        const outra = porEmpresa.get(o.empresaId);
        if (outra && outra !== alvo) outra.ultimaInteracaoEm = maximo(outra.ultimaInteracaoEm, maxPor.get(`Lead:${o.id}`));
      }
    }
  }

  return { itens: linhas, total, possuiMais: total > fim };
}
