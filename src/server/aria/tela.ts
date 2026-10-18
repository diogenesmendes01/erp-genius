import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "../_shared";
import { ConfigAriaSchema, configPadrao, type ConfigAria } from "./config-schema";
import { historicoAria, visaoGeralAria, type ItemHistoricoAria, type VisaoGeralAria } from "./consultas";
import { capacidadesAria } from "./permissoes-tela";
import { situacaoAria } from "./estado";
import { diffConfig } from "./versoes";
import type { AcaoAgenteIATipo, EstadoPolitica, EtapaLead, StatusFonteConhecimento } from "@prisma/client";

// Dados da página /aria (Task 27): tudo que a tela lê em uma chamada. Só leitura; as mutações são
// as Server Actions de versoes/estado/historico/conhecimento.

export const ABAS_ARIA = ["visao", "comportamento", "permissoes", "conhecimento", "handoff", "confianca", "historico", "playground"] as const;
export type AbaAria = (typeof ABAS_ARIA)[number];

export type FonteTela = { id: string; nome: string; tipo: "TEXTO" | "ARQUIVO"; status: StatusFonteConhecimento; erro: string | null; enviavelAoLead: boolean; desatualizada: boolean };

export type DadosTelaAria = {
  estado: EstadoPolitica;
  pausada: boolean;
  motivoPausa: string | null;
  supervisao: boolean;
  publicada: { id: string; numero: number; config: ConfigAria } | null;
  rascunho: { id: string; config: ConfigAria } | null;
  /** Configuração em edição: rascunho, senão a publicada, senão o padrão. */
  config: ConfigAria;
  /** Caminhos alterados do rascunho em relação à publicada (ou ao padrão, se nunca publicada). */
  diff: string[];
  visao: VisaoGeralAria | null;
  historico: { itens: ItemHistoricoAria[]; proximo: string | null } | null;
  fontes: FonteTela[] | null;
  /** Países para o playground (só na aba dele). */
  paises: { id: string; nome: string }[] | null;
};

export type FiltrosTelaAria = {
  dias: 1 | 7 | 30;
  busca?: string;
  acao?: AcaoAgenteIATipo;
  etapa?: EtapaLead;
  resultado?: "PENDENTES" | "EXECUTADAS" | "REJEITADAS" | "DESFEITAS";
  cursor?: string;
};

export async function carregarTelaAria(u: UsuarioSessao, aba: AbaAria, f: FiltrosTelaAria): Promise<DadosTelaAria> {
  const cap = capacidadesAria(u);
  const [sit, agente, rascunhoDb] = await Promise.all([
    situacaoAria(),
    prisma.agenteIA.findUnique({ where: { id: "aria" }, select: { motivoPausa: true } }),
    prisma.versaoAgenteIA.findFirst({ where: { status: "RASCUNHO" } }),
  ]);
  const rascunho = rascunhoDb ? { id: rascunhoDb.id, config: ConfigAriaSchema.parse(rascunhoDb.config) } : null;
  const publicada = sit.versao;
  const config = rascunho?.config ?? publicada?.config ?? configPadrao();
  const diff = rascunho ? diffConfig(publicada?.config ?? configPadrao(), rascunho.config) : [];

  const [visao, historico, fontes, paises] = await Promise.all([
    aba === "visao" ? visaoGeralAria({ dias: f.dias }) : null,
    aba === "historico" ? historicoAria({ busca: f.busca, acao: f.acao, etapa: f.etapa, resultado: f.resultado, cursor: f.cursor }) : null,
    aba === "conhecimento" && cap.has("ver")
      ? prisma.fonteConhecimento.findMany({ where: { arquivadaEm: null }, orderBy: { criadoEm: "desc" }, take: 200 })
      : null,
    aba === "playground" && cap.has("ver")
      ? prisma.pais.findMany({ where: { status: "ATIVO" }, orderBy: { nome: "asc" }, select: { id: true, nome: true } })
      : null,
  ]);
  return {
    estado: sit.estado,
    pausada: sit.pausada,
    motivoPausa: agente?.motivoPausa ?? null,
    supervisao: sit.supervisao,
    publicada,
    rascunho,
    config,
    diff,
    visao,
    historico,
    paises,
    fontes: fontes?.map((x) => ({
      id: x.id, nome: x.nome, tipo: x.tipo, status: x.status, erro: x.erro, enviavelAoLead: x.enviavelAoLead, desatualizada: !!x.validoAte && x.validoAte.getTime() < Date.now(),
    })) ?? null,
  };
}
