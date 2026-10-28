import { EtapaLead, FinalidadeAtendimentoWhatsApp, FinalidadeNumero, Prisma, StatusAtendimentoWhatsApp } from "@prisma/client";

type Coluna = { tipo: "texto" | "booleano" | "inteiro" | "data"; nulo?: boolean; busca?: boolean; enum?: { nome: string; valores: readonly string[] } };
type Relacao = { modelo: Modelo; local: string; remoto: string; muitos?: boolean; nulo?: boolean };
type Tabela = { tabela: string; colunas: Record<string, Coluna>; relacoes: Record<string, Relacao> };
type Modelo = "atendimento" | "conversa" | "numero" | "contato" | "lead" | "aluno" | "responsavel" | "participante" | "acessoTransferido" | "preferencia" | "setor";
const texto = (nulo = false, busca = false): Coluna => ({ tipo: "texto", nulo, busca });
const data = (nulo = false): Coluna => ({ tipo: "data", nulo });
const enumerado = (nome: string, valores: readonly string[]): Coluna => ({ tipo: "texto", enum: { nome, valores } });
const tabelas: Record<Modelo, Tabela> = {
  atendimento: { tabela: "AtendimentoWhatsApp", colunas: {
    id: texto(), conversaId: texto(), finalidade: enumerado("FinalidadeAtendimentoWhatsApp", Object.values(FinalidadeAtendimentoWhatsApp)),
    status: enumerado("StatusAtendimentoWhatsApp", Object.values(StatusAtendimentoWhatsApp)),
    responsavelId: texto(true), leadId: texto(true), alunoId: texto(true), turmaId: texto(true), matriculaId: texto(true),
    encerradoEm: data(true), prazoRespostaEm: data(true), primeiraRespostaEm: data(true), ultimaMensagemEm: data(true), naoLidas: { tipo: "inteiro" },
  }, relacoes: {
    conversa: { modelo: "conversa", local: "conversaId", remoto: "id" },
    lead: { modelo: "lead", local: "leadId", remoto: "id", nulo: true },
    aluno: { modelo: "aluno", local: "alunoId", remoto: "id", nulo: true },
    participantes: { modelo: "participante", local: "id", remoto: "atendimentoId", muitos: true },
    acessosTransferidos: { modelo: "acessoTransferido", local: "id", remoto: "atendimentoId", muitos: true },
  } },
  conversa: { tabela: "ConversaWhatsApp", colunas: { id: texto(), numeroId: texto(), contatoId: texto(true), grupoId: texto(true) }, relacoes: {
    numero: { modelo: "numero", local: "numeroId", remoto: "id" }, contato: { modelo: "contato", local: "contatoId", remoto: "id", nulo: true },
    preferenciasUsuarios: { modelo: "preferencia", local: "id", remoto: "conversaId", muitos: true },
  } },
  numero: { tabela: "NumeroWhatsApp", colunas: { id: texto(), donoId: texto(true), ativo: { tipo: "booleano" }, finalidade: enumerado("FinalidadeNumero", Object.values(FinalidadeNumero)) }, relacoes: {
    setores: { modelo: "setor", local: "id", remoto: "numeroId", muitos: true },
  } },
  contato: { tabela: "ContatoWhatsApp", colunas: { id: texto(), nomeExibicao: texto(true, true), nomePerfil: texto(true, true), telefoneE164: texto(false, true), responsavelId: texto(true), optOutEm: data(true) }, relacoes: {
    responsavel: { modelo: "responsavel", local: "responsavelId", remoto: "id", nulo: true },
  } },
  lead: { tabela: "Lead", colunas: { id: texto(), vendedorDonoId: texto(true), professorExperimentalId: texto(true), etapa: enumerado("EtapaLead", Object.values(EtapaLead)), nome: texto(false, true) }, relacoes: {} },
  aluno: { tabela: "Aluno", colunas: { id: texto(), primeiroNome: texto(false, true), sobrenome: texto(true, true) }, relacoes: {} },
  responsavel: { tabela: "Responsavel", colunas: { id: texto(), nome: texto(false, true) }, relacoes: {} },
  participante: { tabela: "ParticipanteAtendimentoWhatsApp", colunas: { atendimentoId: texto(), usuarioId: texto(), inicio: data(), fim: data(), revogadoEm: data(true), podeEnviar: { tipo: "booleano" } }, relacoes: {} },
  acessoTransferido: { tabela: "AtendimentoAcessoTransferido", colunas: { atendimentoId: texto(), usuarioId: texto(), revogadoEm: data(true) }, relacoes: {} },
  preferencia: { tabela: "PreferenciaConversaUsuario", colunas: { conversaId: texto(), usuarioId: texto(), fixadaEm: data(true), marcadaNaoLida: { tipo: "booleano" }, lidaAte: data(true) }, relacoes: {} },
  setor: { tabela: "NumeroSetorWhatsApp", colunas: { numeroId: texto(), finalidade: enumerado("FinalidadeAtendimentoWhatsApp", Object.values(FinalidadeAtendimentoWhatsApp)) }, relacoes: {} },
};
const objeto = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
function recusar(): never { throw new Error("Filtro Inbox SQL não suportado; atualize o tradutor e os testes de paridade."); }
const coluna = (alias: string, campo: string) => Prisma.raw(`${alias}."${campo}"`);
const juntar = (partes: Prisma.Sql[], op: "AND" | "OR") => partes.length ? Prisma.sql`(${Prisma.join(partes.map(p => Prisma.sql`(${p})`), ` ${op} `)})` : Prisma.sql`TRUE`;
function valor(c: Coluna, v: unknown): Prisma.Sql {
  if (c.enum) {
    if (typeof v !== "string" || !c.enum.valores.includes(v)) return recusar();
    return Prisma.sql`CAST(${v} AS ${Prisma.raw(`"${c.enum.nome}"`)})`;
  }
  if (c.tipo === "data") {
    if (!(v instanceof Date) || !Number.isFinite(v.getTime())) return recusar();
    return Prisma.sql`${v.toISOString()}::timestamp(3)`;
  }
  if (c.tipo === "texto" ? typeof v !== "string" : c.tipo === "booleano" ? typeof v !== "boolean" : typeof v !== "number" || !Number.isSafeInteger(v)) return recusar();
  return Prisma.sql`${v}`;
}
function escalar(alias: string, campo: string, c: Coluna, filtro: unknown): Prisma.Sql | null {
  const col = coluna(alias, campo);
  const igualdade = (v: unknown, negar = false): Prisma.Sql => {
    if (v === null) { if (!c.nulo) return recusar(); return negar ? Prisma.sql`${col} IS NOT NULL` : Prisma.sql`${col} IS NULL`; }
    return negar ? Prisma.sql`${col} <> ${valor(c, v)}` : Prisma.sql`${col} = ${valor(c, v)}`;
  };
  if (!objeto(filtro)) return igualdade(filtro);
  const partes: Prisma.Sql[] = [];
  const chaves = Object.keys(filtro);
  if (Object.hasOwn(filtro, "mode") && (filtro.mode !== "insensitive" || !Object.hasOwn(filtro, "contains"))) return recusar();
  for (const op of chaves) {
    const v = filtro[op];
    if (op === "mode") continue;
    if (op === "equals" || op === "not") partes.push(igualdade(v, op === "not"));
    else if (op === "in") {
      if (!Array.isArray(v)) return recusar();
      partes.push(v.length ? Prisma.sql`${col} IN (${Prisma.join(v.map(i => valor(c, i)))})` : Prisma.sql`FALSE`);
    } else if (op === "contains") {
      if (!c.busca || typeof v !== "string") return recusar();
      const termo = `%${v}%`; partes.push(filtro.mode === "insensitive" ? Prisma.sql`${col} ILIKE ${termo}` : Prisma.sql`${col} LIKE ${termo}`);
    } else if (["lt", "lte", "gt", "gte"].includes(op)) {
      if (c.tipo !== "data" && c.tipo !== "inteiro") return recusar();
      const operacao = op === "lt" ? "<" : op === "lte" ? "<=" : op === "gt" ? ">" : ">=";
      partes.push(Prisma.sql`${col} ${Prisma.raw(operacao)} ${valor(c, v)}`);
    } else return recusar();
  }
  return partes.length ? juntar(partes, "AND") : null;
}

function grupoVazio(v: unknown): boolean {
  if (!objeto(v)) return false;
  return Object.entries(v).every(([k, x]) => (k === "AND" || k === "OR" || k === "NOT")
    && (Array.isArray(x) ? x : [x]).every(grupoVazio));
}

export function whereAtendimentoEmSql(where: Prisma.AtendimentoWhatsAppWhereInput): Prisma.Sql {
  let sequencia = 0;
  function condicao(modelo: Modelo, alias: string, filtro: unknown): Prisma.Sql | null {
    if (!objeto(filtro)) return recusar();
    const meta = tabelas[modelo], partes: Prisma.Sql[] = [];
    for (const [campo, entrada] of Object.entries(filtro)) {
      const logico = campo === "AND" || campo === "OR" || campo === "NOT";
      if (!logico && !Object.hasOwn(meta.colunas, campo) && !Object.hasOwn(meta.relacoes, campo)) return recusar();
      if (entrada === undefined) continue;
      if (logico) {
        if (campo === "OR" && !Array.isArray(entrada)) return recusar();
        const filhos = (Array.isArray(entrada) ? entrada : [entrada]).map(w => {
          const c = condicao(modelo, alias, w);
          return grupoVazio(w) ? null : c;
        }).filter((w): w is Prisma.Sql => w !== null);
        if (campo === "OR") partes.push(filhos.length ? juntar(filhos, "OR") : Prisma.sql`FALSE`);
        else if (filhos.length) partes.push(juntar(campo === "NOT" ? filhos.map(w => Prisma.sql`NOT (${w})`) : filhos, "AND"));
      } else if (Object.hasOwn(meta.colunas, campo)) {
        const c = escalar(alias, campo, meta.colunas[campo], entrada); if (c) partes.push(c);
      } else {
        const rel = meta.relacoes[campo];
        const existe = (w: unknown): Prisma.Sql => {
          const filho = `r${++sequencia}`, alvo = tabelas[rel.modelo];
          const c = condicao(rel.modelo, filho, w) ?? Prisma.sql`TRUE`;
          return Prisma.sql`EXISTS (SELECT 1 FROM ${Prisma.raw(`"${alvo.tabela}"`)} ${Prisma.raw(filho)} WHERE ${coluna(filho, rel.remoto)} = ${coluna(alias, rel.local)} AND (${c}))`;
        };
        if (rel.muitos) {
          if (!objeto(entrada)) return recusar();
          for (const [op, w] of Object.entries(entrada)) {
            if (op !== "some" && op !== "none") return recusar();
            partes.push(op === "some" ? existe(w) : Prisma.sql`NOT (${existe(w)})`);
          }
        } else if (entrada === null) {
          if (!rel.nulo) return recusar(); partes.push(Prisma.sql`${coluna(alias, rel.local)} IS NULL`);
        } else {
          if (!objeto(entrada) || Object.hasOwn(entrada, "isNot")) return recusar();
          if (Object.hasOwn(entrada, "is")) {
            if (Object.keys(entrada).length !== 1) return recusar();
            if (entrada.is === null) { if (!rel.nulo) return recusar(); partes.push(Prisma.sql`${coluna(alias, rel.local)} IS NULL`); }
            else partes.push(existe(entrada.is));
          } else {
            if (!Object.keys(entrada).length && rel.nulo) return recusar();
            partes.push(existe(entrada));
          }
        }
      }
    }
    return partes.length ? juntar(partes, "AND") : null;
  }
  return condicao("atendimento", "a", where) ?? Prisma.sql`TRUE`;
}
