import { EtapaLead, Segmento, Temperatura, type Prisma } from "@prisma/client";

// Filtros da lista de leads na URL (docs/42-auditoria-frontend-ux.md, E4) — mesmo desenho da lista
// de alunos (src/server/alunos/filtros.ts): viviam em useState sobre a carteira inteira carregada de
// uma vez, sem busca e sem página; voltar da ficha perdia tudo e a planilha ignorava o recorte. Um
// único leitor serve a página e a rota de exportação. Módulo puro: sem Prisma client, testável.

export const LEADS_POR_PAGINA = 50;

export type TipoLead = "pf" | "b2b";

export type FiltrosLeads = {
  busca: string;
  tipo: TipoLead | null;
  etapa: EtapaLead | null;
  segmento: Segmento | null;
  temperatura: Temperatura | null;
  donoId: string | null;
  pagina: number;
};

/** Filtros aceitos pela consulta de leads (pipeline, lista, exportação). */
export interface FiltrosLead {
  busca?: string;
  b2b?: boolean;
  segmento?: Segmento;
  temperatura?: Temperatura;
  etapa?: EtapaLead;
  vendedorId?: string;
}

type Parametros = Record<string, string | string[] | undefined> | URLSearchParams;

function valor(p: Parametros, chave: string): string {
  const v = p instanceof URLSearchParams ? p.get(chave) : p[chave];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

function doEnum<T extends string>(e: Record<string, T>, v: string): T | null {
  return (Object.values(e) as string[]).includes(v) ? (v as T) : null;
}

/** Lê e valida: busca até 100 caracteres; enums só com valores conhecidos; id curto; página inteira 1..100000. Resto é ignorado. */
export function lerFiltrosLeads(p: Parametros): FiltrosLeads {
  const tipo = valor(p, "tipo");
  const dono = valor(p, "dono");
  const pagina = Number(valor(p, "pagina") || 1);
  return {
    busca: valor(p, "busca").slice(0, 100),
    tipo: tipo === "pf" || tipo === "b2b" ? tipo : null,
    etapa: doEnum(EtapaLead, valor(p, "etapa")),
    segmento: doEnum(Segmento, valor(p, "segmento")),
    temperatura: doEnum(Temperatura, valor(p, "temperatura")),
    donoId: dono && dono.length <= 64 && /^[\w-]+$/.test(dono) ? dono : null,
    pagina: Number.isInteger(pagina) && pagina >= 1 && pagina <= 100000 ? pagina : 1,
  };
}

/** Query string dos filtros (sem os vazios e sem a página 1). `semPagina` para links de filtro e exportação. */
export function filtrosLeadsParaQuery(f: FiltrosLeads, { semPagina = false } = {}): string {
  const q = new URLSearchParams();
  if (f.busca) q.set("busca", f.busca);
  if (f.tipo) q.set("tipo", f.tipo);
  if (f.etapa) q.set("etapa", f.etapa);
  if (f.segmento) q.set("segmento", f.segmento);
  if (f.temperatura) q.set("temperatura", f.temperatura);
  if (f.donoId) q.set("dono", f.donoId);
  if (!semPagina && f.pagina > 1) q.set("pagina", String(f.pagina));
  return q.toString();
}

export const temFiltroLeads = (f: FiltrosLeads) =>
  !!(f.busca || f.tipo || f.etapa || f.segmento || f.temperatura || f.donoId);

/** Filtros da URL → filtros da consulta. */
export function filtrosDaConsultaLeads(f: FiltrosLeads): FiltrosLead {
  return {
    ...(f.busca ? { busca: f.busca } : {}),
    ...(f.tipo ? { b2b: f.tipo === "b2b" } : {}),
    ...(f.etapa ? { etapa: f.etapa } : {}),
    ...(f.segmento ? { segmento: f.segmento } : {}),
    ...(f.temperatura ? { temperatura: f.temperatura } : {}),
    ...(f.donoId ? { vendedorId: f.donoId } : {}),
  };
}

/** Palavras da busca (no máximo 6 — limita o tamanho da consulta). */
export const palavrasDaBuscaLeads = (busca: string) => busca.split(/\s+/).filter(Boolean).slice(0, 6);

/**
 * Condição dos filtros — sempre combinada com o escopo comercial por quem consulta (AND), nunca no
 * lugar dele. Busca por palavras: cada uma precisa aparecer no nome, no código ou no telefone
 * ("Ana Silva" acha "Ana Maria Silva"; "8888" acha pelo telefone).
 */
export function whereFiltrosLead(filtros: FiltrosLead): Prisma.LeadWhereInput {
  const palavras = palavrasDaBuscaLeads(filtros.busca ?? "");
  return {
    ...(filtros.b2b !== undefined ? { b2b: filtros.b2b } : {}),
    ...(filtros.segmento ? { segmento: filtros.segmento } : {}),
    ...(filtros.temperatura ? { temperatura: filtros.temperatura } : {}),
    ...(filtros.etapa ? { etapa: filtros.etapa } : {}),
    ...(filtros.vendedorId ? { vendedorDonoId: filtros.vendedorId } : {}),
    ...(palavras.length
      ? {
          AND: palavras.map((palavra) => {
            const contem = { contains: palavra, mode: "insensitive" as const };
            // Telefone é guardado em E.164 (+50688887777): compara só os dígitos, com ao menos 3
            // ("8888-7777" acha; "a1" não varre telefones por um dígito solto).
            const digitos = palavra.replace(/\D/g, "");
            return {
              OR: [
                { nome: contem },
                { codigo: contem },
                ...(digitos.length >= 3 ? [{ telefoneE164: { contains: digitos } }] : []),
              ],
            };
          }),
        }
      : {}),
  };
}

/** Dono que não está mais nas opções (vendedor desligado, fora da equipe, papel sem o filtro) é descartado. */
export function sanearFiltrosLeads(f: FiltrosLeads, opcoes: { donos: { id: string }[] }): FiltrosLeads {
  return { ...f, donoId: opcoes.donos.some((d) => d.id === f.donoId) ? f.donoId : null };
}

/** Link da lista com estes filtros ("/leads" quando não há nenhum). */
export const hrefLeads = (f: FiltrosLeads) => {
  const q = filtrosLeadsParaQuery(f);
  return q ? `/leads?${q}` : "/leads";
};

/** Página além do fim (link antigo, filtro que encolheu): destino da última página que existe; null se a página é válida. */
export function destinoPaginaLeads(f: FiltrosLeads, total: number): string | null {
  const ultima = Math.max(1, Math.ceil(total / LEADS_POR_PAGINA));
  return f.pagina > ultima ? hrefLeads({ ...f, pagina: ultima }) : null;
}

/** Valores dos campos do formulário (texto), a partir dos filtros. */
export type CamposLeads = { busca: string; tipo: string; etapa: string; segmento: string; temperatura: string; dono: string };
export const camposDosFiltrosLeads = (f: FiltrosLeads): CamposLeads => ({
  busca: f.busca,
  tipo: f.tipo ?? "",
  etapa: f.etapa ?? "",
  segmento: f.segmento ?? "",
  temperatura: f.temperatura ?? "",
  dono: f.donoId ?? "",
});

/**
 * Quando a URL muda, só os campos cujo FILTRO mudou são atualizados; os demais mantêm o que a pessoa
 * está digitando (o formulário não é recriado, o foco não se perde).
 */
export function sincronizarCamposLeads(atuais: CamposLeads, anteriores: FiltrosLeads, novos: FiltrosLeads): CamposLeads {
  const antes = camposDosFiltrosLeads(anteriores), depois = camposDosFiltrosLeads(novos);
  const r = { ...atuais };
  for (const k of Object.keys(depois) as (keyof CamposLeads)[]) if (antes[k] !== depois[k]) r[k] = depois[k];
  return r;
}

/** Link a partir dos campos do formulário — mesmo leitor/validação da página; volta à página 1. */
export const hrefDosCamposLeads = (c: CamposLeads) => hrefLeads(lerFiltrosLeads({ ...c }));
