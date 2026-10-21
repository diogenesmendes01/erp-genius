import { Papel, type CategoriaDocumento, type EtapaLead, type MotivoPerda, type Prisma, type Segmento, type StatusCobranca, type Temperatura } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { ETAPA_LABEL, MOTIVO_PERDA_LABEL, TEMPERATURA_LABEL } from "@/lib/labels";
import { capacidadesCrm } from "./permissoes";
import { escopoPessoas } from "./pessoas";

// Q8: motivos de perda fixos (MotivoPerda); alternativa configurável em Configurações (Fase 5).

export type ItemHistorico = {
  id: string;
  tipo: string;
  rotulo: string;
  autor: string | null;
  em: Date;
  /** Texto da nota interna (só em NotaInterna); o resto do payload nunca sai. */
  texto?: string | null;
};

export type DetalheOportunidade = {
  id: string;
  codigo: string | null;
  nome: string;
  b2b: boolean;
  etapa: EtapaLead;
  temperatura: Temperatura;
  valorPrevisto: string | null;
  moeda: string | null;
  pais: string | null;
  dono: { id: string; nome: string } | null;
  proximaAcao: string | null;
  proximoFollowUp: Date | null;
  dataExperimental: Date | null;
  motivoPerda: MotivoPerda | null;
  criadoEm: Date;
  pessoaId: string | null;
  interesse: string | null;
  objetivo: string | null;
  urgencia: string | null;
  orcamento: string | null;
  objecao: string | null;
  /** Campos editados no painel (B1 da R1 do #216: o que só a ficha antiga de /leads editava). */
  telefoneE164: string | null;
  paisId: string | null;
  segmento: Segmento;
  origemCampanha: string | null;
  origemConjunto: string | null;
  origemAnuncio: string | null;
  origemPalavra: string | null;
  planoPrevisto: string | null;
  comissaoPrevista: string | null;
  dataProposta: Date | null;
  /** Documentos ativos, com o mesmo filtro da ficha antiga (obterLead): fora do cadastro administrativo,
   * some OUTRO e, depois que a secretaria assume a matrícula, só fica PROPOSTA. */
  documentos: { id: string; categoria: CategoriaDocumento; nome: string; url: string }[];
  /** Taxa de matrícula (cobrança tipo MATRICULA) da matrícula da oportunidade, quando existe. */
  taxaMatricula: {
    cobrancaId: string;
    status: StatusCobranca;
    linkPagamento: string | null;
    linkEnviadoEm: Date | null;
  } | null;
};

type Payload = Record<string, unknown> | null;

const texto = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** "Exp. Agendada" -> "Exp. agendada"; "1º Contato" -> "1º contato" (só a primeira letra maiúscula). */
function frase(s: string): string {
  const baixa = s.toLocaleLowerCase("pt-BR");
  return baixa.charAt(0).toLocaleUpperCase("pt-BR") + baixa.slice(1);
}

const etapa = (v: unknown): string | null => {
  const k = texto(v);
  return k ? frase(ETAPA_LABEL[k as EtapaLead] ?? k) : null;
};

/** Rótulo legível por tipo de evento do agregado "Lead". Nunca devolve o payload cru. */
export const ROTULO_EVENTO_CRM: Record<string, (payload: Payload) => string> = {
  LeadCriado: () => "Oportunidade criada",
  EtapaAlterada: (p) => {
    const de = etapa(p?.de);
    const para = etapa(p?.para);
    return de && para ? `Etapa: ${de} → ${para}` : para ? `Etapa: ${para}` : "Etapa alterada";
  },
  ExperimentalAgendada: () => "Experimental agendada",
  ExperimentalRealizada: () => "Experimental realizada",
  NoShow: () => "Não compareceu à experimental",
  PropostaEnviada: () => "Proposta enviada",
  LeadPerdido: (p) => {
    const m = texto(p?.motivoPerda);
    return m ? `Perdida: ${MOTIVO_PERDA_LABEL[m as MotivoPerda] ?? "Outro"}` : "Perdida";
  },
  LeadAtribuido: () => "Responsável alterado",
  LeadEditado: (p) => {
    if (p?.campo === "temperatura") {
      const rot = (v: unknown) => TEMPERATURA_LABEL[texto(v) as Temperatura] ?? null;
      const de = rot(p.de);
      const para = rot(p.temperatura);
      return de && para ? `Temperatura: ${frase(de)} → ${frase(para)}` : "Temperatura alterada";
    }
    return "Dados da oportunidade editados";
  },
  ResumoAtualizado: () => "Resumo atualizado",
  DatasAtualizadas: () => "Datas atualizadas",
  InteracaoRegistrada: () => "Interação registrada",
  NotaInterna: () => "Nota interna",
  // Agregado "Pessoa" (ficha do contato).
  PessoaCriada: () => "Contato criado",
  PessoaEditada: () => "Dados do contato editados",
  TagAtribuida: () => "Tag atribuída",
  TagRemovida: () => "Tag removida",
  OptOutRegistrado: () => "Opt-out registrado",
  OptOutRemovido: () => "Opt-out removido",
  DocumentoAnexado: () => "Documento anexado",
  DocumentoArquivado: () => "Documento arquivado",
  ExperimentalAtribuida: () => "Professor da experimental atribuído",
  PessoasMescladas: () => "Contatos mesclados",
};

export function rotuloEventoCrm(tipo: string, payload: unknown): string {
  const f = ROTULO_EVENTO_CRM[tipo];
  if (!f) return "Alteração registrada";
  const p = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : null;
  return f(p);
}

async function visivel(id: string, usuario: UsuarioSessao): Promise<boolean> {
  if (!usuario?.id || !capacidadesCrm(usuario.papeis).has("funil.ver")) return false;
  const achada = await prisma.oportunidade.findFirst({
    where: { AND: [{ id }, await escopoComercialAtual(usuario)] },
    select: { id: true },
  });
  return !!achada;
}

/** Histórico rotulado (mais antigo primeiro). `null` = fora do escopo do usuário. */
export async function historicoOportunidade(id: string, usuario: UsuarioSessao): Promise<ItemHistorico[] | null> {
  if (!(await visivel(id, usuario))) return null;
  const eventos = await prisma.evento.findMany({
    where: { agregadoTipo: "Lead", agregadoId: id },
    orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
    include: { autor: { select: { nome: true } } },
  });
  return eventos.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    rotulo: rotuloEventoCrm(e.tipo, e.payload),
    autor: e.autor?.nome ?? null,
    em: e.criadoEm,
  }));
}

/** Detalhe da oportunidade para o painel. `null` = fora do escopo do usuário. */
export async function obterOportunidade(id: string, usuario: UsuarioSessao): Promise<DetalheOportunidade | null> {
  if (!usuario?.id || !capacidadesCrm(usuario.papeis).has("funil.ver")) return null;
  const l = await prisma.oportunidade.findFirst({
    where: { AND: [{ id }, await escopoComercialAtual(usuario)] },
    include: {
      pais: { select: { nome: true, moedaLocal: true } },
      vendedor: { select: { id: true, nome: true } },
      documentos: { where: { arquivado: false }, orderBy: { criadoEm: "desc" }, select: { id: true, categoria: true, nome: true, url: true } },
      matricula: {
        select: {
          secretariaAssumiuEm: true,
          cobrancas: {
            where: { tipo: "MATRICULA" },
            orderBy: { criadoEm: "asc" },
            take: 1,
            select: { id: true, status: true, linkPagamento: true, linkEnviadoEm: true },
          },
        },
      },
    },
  });
  if (!l) return null;
  const taxa = l.matricula?.cobrancas[0] ?? null;
  const cadastroAdministrativo = usuario.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.SECRETARIA_ACADEMICA);
  const documentos = cadastroAdministrativo
    ? l.documentos
    : l.documentos.filter((d) => d.categoria !== "OUTRO" && (!l.matricula?.secretariaAssumiuEm || d.categoria === "PROPOSTA"));
  return {
    id: l.id,
    codigo: l.codigo,
    nome: l.nome,
    b2b: l.b2b,
    etapa: l.etapa,
    temperatura: l.temperatura,
    valorPrevisto: l.valorPrevisto ? l.valorPrevisto.toFixed(2) : null,
    moeda: l.pais?.moedaLocal ?? null,
    pais: l.pais?.nome ?? null,
    dono: l.vendedor ? { id: l.vendedor.id, nome: l.vendedor.nome } : null,
    proximaAcao: l.proximaAcao,
    proximoFollowUp: l.proximoFollowUp,
    dataExperimental: l.dataExperimental,
    motivoPerda: l.motivoPerda,
    criadoEm: l.criadoEm,
    pessoaId: l.pessoaId,
    interesse: l.interesse,
    objetivo: l.objetivo,
    urgencia: l.urgencia,
    orcamento: l.orcamento,
    objecao: l.objecao,
    telefoneE164: l.telefoneE164,
    paisId: l.paisId,
    segmento: l.segmento,
    origemCampanha: l.origemCampanha,
    origemConjunto: l.origemConjunto,
    origemAnuncio: l.origemAnuncio,
    origemPalavra: l.origemPalavra,
    planoPrevisto: l.planoPrevisto,
    comissaoPrevista: l.comissaoPrevista ? l.comissaoPrevista.toFixed(2) : null,
    dataProposta: l.dataProposta,
    documentos,
    taxaMatricula: taxa
      ? { cobrancaId: taxa.id, status: taxa.status, linkPagamento: taxa.linkPagamento, linkEnviadoEm: taxa.linkEnviadoEm }
      : null,
  };
}


export type FiltroHistoricoPessoa = "tudo" | "notas" | "etapas" | "alteracoes";

const TIPOS_POR_FILTRO: Record<Exclude<FiltroHistoricoPessoa, "tudo">, string[]> = {
  notas: ["NotaInterna"],
  etapas: ["EtapaAlterada", "LeadPerdido"],
  alteracoes: ["PessoaEditada", "LeadEditado", "LeadAtribuido", "DatasAtualizadas", "ResumoAtualizado", "TagAtribuida", "TagRemovida"],
};

const LIMITE_HISTORICO_PESSOA = 500;

/**
 * Histórico unificado da pessoa (mais antigo primeiro): eventos da Pessoa e dos "Lead" das oportunidades dela
 * que o usuário enxerga; eventos do "Aluno" ligado só para Secretaria e Administrador.
 * `null` = fora do escopo do usuário.
 */
export async function historicoPessoa(
  id: string,
  usuario: UsuarioSessao,
  filtro: FiltroHistoricoPessoa = "tudo",
): Promise<ItemHistorico[] | null> {
  if (!usuario?.id || !capacidadesCrm(usuario.papeis).has("contatos.ver")) return null;
  const pessoa = await prisma.pessoa.findFirst({
    where: { AND: [{ id }, await escopoPessoas(usuario)] },
    select: { id: true, aluno: { select: { id: true } } },
  });
  if (!pessoa) return null;

  // Lápides mescladas nesta pessoa (de forma transitiva): as notas e o histórico delas passaram para cá.
  const ids = [id];
  for (let fronteira = [id]; fronteira.length; ) {
    const lapides = await prisma.pessoa.findMany({
      where: { mescladaEmId: { in: fronteira }, id: { notIn: ids } },
      select: { id: true },
    });
    fronteira = lapides.map((l) => l.id);
    ids.push(...fronteira);
  }

  const ou: Prisma.EventoWhereInput[] = [{ agregadoTipo: "Pessoa", agregadoId: { in: ids } }];
  if (capacidadesCrm(usuario.papeis).has("funil.ver")) {
    const ops = await prisma.oportunidade.findMany({
      where: { AND: [{ pessoaId: id }, await escopoComercialAtual(usuario)] },
      select: { id: true },
    });
    if (ops.length) ou.push({ agregadoTipo: "Lead", agregadoId: { in: ops.map((o) => o.id) } });
  }
  if (pessoa.aluno && (usuario.papeis.includes(Papel.SECRETARIA_ACADEMICA) || usuario.papeis.includes(Papel.ADMINISTRADOR))) {
    ou.push({ agregadoTipo: "Aluno", agregadoId: pessoa.aluno.id });
  }

  const eventos = await prisma.evento.findMany({
    where: { AND: [{ OR: ou }, ...(filtro === "tudo" ? [] : [{ tipo: { in: TIPOS_POR_FILTRO[filtro] } }])] },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    take: LIMITE_HISTORICO_PESSOA,
    include: { autor: { select: { nome: true } } },
  });
  // A mescla grava o mesmo PessoasMescladas na principal e na lápide; fica só o da principal daquela mescla.
  const unicos = eventos.filter((e) => {
    if (e.tipo !== "PessoasMescladas" || e.agregadoTipo !== "Pessoa") return true;
    const p = e.payload && typeof e.payload === "object" && !Array.isArray(e.payload) ? (e.payload as Record<string, unknown>) : null;
    return !p?.principalId || p.principalId === e.agregadoId;
  });
  return unicos.reverse().map((e) => {
    const p = e.payload && typeof e.payload === "object" && !Array.isArray(e.payload) ? (e.payload as Record<string, unknown>) : null;
    const item: ItemHistorico = {
      id: e.id,
      tipo: e.tipo,
      rotulo: rotuloEventoCrm(e.tipo, e.payload),
      autor: e.autor?.nome ?? null,
      em: e.criadoEm,
    };
    if (e.tipo === "NotaInterna") item.texto = texto(p?.texto) ?? texto(p?.nota);
    return item;
  });
}
