import { EtapaLead, OrigemCanal, Papel, type CorTag, type Prisma, type Temperatura } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, exigirSessao, type UsuarioSessao } from "@/server/_shared/sessao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { registrarEvento } from "@/server/_shared/evento";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { diffCampos } from "@/server/_shared/regras";
import { palavrasDaBuscaLeads } from "@/server/comercial/filtros";
import { capacidadesCrm, exigirCapacidadeCrm } from "./permissoes";
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

// ---------------------------------------------------------------------------
// Ficha da pessoa: detalhe, edição auditada, nota interna e opt-out (Tarefa 20)
// ---------------------------------------------------------------------------

export type DetalheContato = {
  id: string;
  codigo: string | null;
  nome: string;
  email: string | null;
  cidade: string | null;
  cargo: string | null;
  linkedin: string | null;
  origemCanal: OrigemCanal | null;
  empresa: { id: string; nome: string } | null;
  telefones: { telefone: string; optOut: boolean }[];
  optOut: boolean;
  ehAluno: boolean;
  tags: { id: string; nome: string; cor: CorTag }[];
  /** Oportunidades no escopo comercial do usuário (vazio para quem não é do comercial). */
  oportunidades: { id: string; nome: string; etapa: EtapaLead; temperatura: Temperatura; dono: string | null }[];
  criadoEm: Date;
};

/** Detalhe da pessoa para a ficha. `null` = fora do escopo do usuário. */
export async function obterContato(id: string, usuario: UsuarioSessao): Promise<DetalheContato | null> {
  if (!usuario?.id || !capacidadesCrm(usuario.papeis).has("contatos.ver")) return null;
  const { comercial } = papeisDe(usuario);
  const escopoO = comercial ? await escopoComercialAtual(usuario) : null;
  const p = await prisma.pessoa.findFirst({
    where: { AND: [{ id }, await escopoPessoas(usuario)] },
    select: {
      id: true,
      codigo: true,
      nome: true,
      email: true,
      cidade: true,
      cargo: true,
      linkedin: true,
      origemCanal: true,
      criadoEm: true,
      empresa: { select: { id: true, nome: true } },
      aluno: { select: { id: true } },
      contatosWhatsApp: { select: { telefoneE164: true, optOutEm: true }, orderBy: { criadoEm: "asc" } },
      tags: { select: { tag: { select: { id: true, nome: true, cor: true } } } },
    },
  });
  if (!p) return null;
  const ops = escopoO
    ? await prisma.oportunidade.findMany({
        where: { AND: [{ pessoaId: id }, escopoO] },
        orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
        select: { id: true, nome: true, etapa: true, temperatura: true, vendedor: { select: { nome: true } } },
      })
    : [];
  return {
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    email: p.email,
    cidade: p.cidade,
    cargo: p.cargo,
    linkedin: p.linkedin,
    origemCanal: p.origemCanal,
    empresa: p.empresa,
    telefones: p.contatosWhatsApp.map((c) => ({ telefone: c.telefoneE164, optOut: !!c.optOutEm })),
    optOut: p.contatosWhatsApp.length > 0 && p.contatosWhatsApp.every((c) => c.optOutEm),
    ehAluno: !!p.aluno,
    tags: p.tags.map((t) => t.tag),
    oportunidades: ops.map((o) => ({
      id: o.id,
      nome: o.nome,
      etapa: o.etapa,
      temperatura: o.temperatura,
      dono: o.vendedor?.nome ?? null,
    })),
    criadoEm: p.criadoEm,
  };
}

const opcional = (max: number, msg: string) =>
  z.string().trim().max(max, msg).nullable().optional().transform((v) => (v === undefined ? undefined : v || null));

const EditarPessoaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(200, "O nome deve ter até 200 caracteres.").optional(),
  email: z
    .string()
    .trim()
    .max(200, "O e-mail deve ter até 200 caracteres.")
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v ? v.toLowerCase() : null))
    .refine((v) => !v || z.string().email().safeParse(v).success, "Informe um e-mail válido."),
  cidade: opcional(120, "A cidade deve ter até 120 caracteres."),
  cargo: opcional(120, "O cargo deve ter até 120 caracteres."),
  linkedin: opcional(300, "O LinkedIn deve ter até 300 caracteres."),
  origemCanal: z.nativeEnum(OrigemCanal, { errorMap: () => ({ message: "Origem inválida." }) }).nullable().optional(),
  empresaId: z.string().min(1).nullable().optional(),
});

export type EditarPessoaInput = {
  nome?: string;
  email?: string | null;
  cidade?: string | null;
  cargo?: string | null;
  linkedin?: string | null;
  origemCanal?: OrigemCanal | null;
  empresaId?: string | null;
};

type CamposPessoa = {
  nome: string;
  email: string | null;
  cidade: string | null;
  cargo: string | null;
  linkedin: string | null;
  origemCanal: OrigemCanal | null;
  empresaId: string | null;
};

/** Carrega a pessoa dentro do escopo do autor (na transação) ou recusa. */
async function pessoaNoEscopo(tx: Prisma.TransactionClient, id: string, autor: UsuarioSessao) {
  const pessoa = await tx.pessoa.findFirst({
    where: { AND: [{ id }, await escopoPessoas(autor, tx)] },
    include: { aluno: { select: { id: true } } },
  });
  if (!pessoa) throw new ErroRegra("Contato não encontrado.");
  return pessoa;
}

/** Edita a pessoa. Grava `PessoaEditada` só com os campos que mudaram (e-mail sem o valor cru). */
export async function editarPessoa(id: string, input: EditarPessoaInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "contatos.editar");
    const dados = EditarPessoaSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const atual = await pessoaNoEscopo(tx, id, autor);
      const mudancas: Partial<CamposPessoa> = {};
      for (const k of ["nome", "email", "cidade", "cargo", "linkedin", "origemCanal", "empresaId"] as const) {
        if (dados[k] !== undefined) (mudancas as Record<string, unknown>)[k] = dados[k];
      }
      const antesCampos: CamposPessoa = {
        nome: atual.nome,
        email: atual.email,
        cidade: atual.cidade,
        cargo: atual.cargo,
        linkedin: atual.linkedin,
        origemCanal: atual.origemCanal,
        empresaId: atual.empresaId,
      };
      const novo: CamposPessoa = { ...antesCampos, ...mudancas };
      const { antes, depois } = diffCampos(antesCampos, novo);
      const campos = Object.keys(depois) as (keyof CamposPessoa)[];
      if (!campos.length) return; // nada mudou: sem escrita e sem Evento

      if (atual.aluno && (campos.includes("nome") || campos.includes("email")) && !autor.papeis.includes(Papel.ADMINISTRADOR)) {
        throw new ErroRegra("Nome e e-mail de aluno são alterados pela Secretaria.");
      }
      if (depois.empresaId) {
        const empresa = await tx.empresa.findUnique({ where: { id: depois.empresaId }, select: { id: true } });
        if (!empresa) throw new ErroRegra("Empresa não encontrada.");
      }

      await tx.pessoa.update({ where: { id }, data: depois });
      const payload: Record<string, Prisma.InputJsonValue> = {};
      for (const c of campos) {
        // E-mail é dado de contato: o Evento guarda só se estava e passou a estar preenchido.
        payload[c] =
          c === "email"
            ? { de: antes.email ? "definido" : null, para: depois.email ? "definido" : null }
            : { de: (antes[c] as string | null | undefined) ?? null, para: (depois[c] as string | null | undefined) ?? null };
      }
      await registrarEvento(tx, {
        tipo: "PessoaEditada",
        agregadoTipo: "Pessoa",
        agregadoId: id,
        autorId: autor.id,
        payload,
      });
    });
  });
}

const NotaSchema = z.string().trim().min(1, "Escreva a nota.").max(2000, "A nota deve ter até 2.000 caracteres.");
const MotivoOptOutSchema = z.string().trim().min(1, "Informe o motivo.").max(500, "O motivo deve ter até 500 caracteres.");

/** Nota interna da equipe sobre a pessoa (`Evento NotaInterna` no agregado Pessoa). Nunca é enviada ao contato. */
export async function registrarNotaPessoa(id: string, texto: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "contatos.editar");
    const nota = NotaSchema.parse(texto);
    await prisma.$transaction(async (tx) => {
      await pessoaNoEscopo(tx, id, autor);
      await registrarEvento(tx, {
        tipo: "NotaInterna",
        agregadoTipo: "Pessoa",
        agregadoId: id,
        autorId: autor.id,
        payload: { texto: nota },
      });
    });
  });
}

/** Opt-out da pessoa: marca todos os telefones. Não há desfazer por esta ação. */
export async function registrarOptOut(pessoaId: string, motivo: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "contatos.editar");
    const m = MotivoOptOutSchema.parse(motivo);
    await prisma.$transaction(async (tx) => {
      await pessoaNoEscopo(tx, pessoaId, autor);
      const contatos = await tx.contatoWhatsApp.findMany({
        where: { pessoaId, optOutEm: null },
        select: { id: true },
      });
      if (!contatos.length) {
        const total = await tx.contatoWhatsApp.count({ where: { pessoaId } });
        throw new ErroRegra(total ? "Esta pessoa já está em opt-out." : "Esta pessoa não tem telefone cadastrado.");
      }
      const agora = new Date();
      await tx.contatoWhatsApp.updateMany({ where: { id: { in: contatos.map((c) => c.id) }, optOutEm: null }, data: { optOutEm: agora } });
      for (const c of contatos) {
        await registrarEvento(tx, {
          tipo: "OptOutRegistrado",
          agregadoTipo: "ContatoWhatsApp",
          agregadoId: c.id,
          autorId: autor.id,
          payload: { via: "ficha" },
        });
      }
      await registrarEvento(tx, {
        tipo: "OptOutRegistrado",
        agregadoTipo: "Pessoa",
        agregadoId: pessoaId,
        autorId: autor.id,
        payload: { motivo: m },
      });
    });
  });
}
