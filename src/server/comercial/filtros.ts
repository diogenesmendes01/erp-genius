import { EtapaLead, Segmento, Temperatura, type Prisma } from "@prisma/client";

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

export const palavrasDaBuscaLeads = (busca: string) => busca.split(/\s+/).filter(Boolean).slice(0, 6);

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
