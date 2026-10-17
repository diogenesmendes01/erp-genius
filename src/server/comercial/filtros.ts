import { EtapaLead, Segmento, Temperatura, type Prisma } from "@prisma/client";

// Filtros de leads na URL (docs/42-auditoria-frontend-ux.md, E4) — mesmo desenho dos filtros de
// alunos (src/server/alunos/filtros.ts). A lista /leads saiu na Fase 2 (o funil a substituiu); o
// leitor continua servindo a rota de exportação. Módulo puro: sem Prisma client, testável.

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
export function whereFiltrosLead(filtros: FiltrosLead): Prisma.OportunidadeWhereInput {
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
