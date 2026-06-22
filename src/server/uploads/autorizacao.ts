import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Autorização POR OBJETO para leitura de arquivos privados (GET /api/files/[...path]).
//
// Abordagem (b): DERIVAR do agregado. A URL canônica do upload (`/api/files/<arquivo>`)
// já é persistida diretamente nos agregados que a referenciam — `Cobranca.comprovanteUrl`
// (comprovante financeiro) e `Documento.url` (documentos do lead). Em vez de criar um
// modelo de metadados (abordagem a) — que exigiria popular o vínculo só DEPOIS que o
// agregado é salvo e backfill das linhas existentes — descobrimos no GET qual agregado
// referencia exatamente aquela URL e aplicamos as MESMAS regras de papel/escopo já usadas
// nas consultas (escopoLeads / quem registra pagamento). Acesso negado => 403.

/** Usuário mínimo necessário para a checagem de escopo. */
export interface UsuarioArquivo {
  id: string;
  papeis: Papel[];
}

// Papéis que podem ler comprovantes financeiros — alinhado a quem opera/visualiza o
// financeiro (registra pagamento + acesso à aba Financeiro). Admin sempre passa.
const PAPEIS_COMPROVANTE: Papel[] = [
  Papel.FINANCEIRO,
  Papel.SECRETARIA_ACADEMICA,
  Papel.GERENTE_COMERCIAL,
];

function ehAdmin(papeis: Papel[]): boolean {
  return papeis.includes(Papel.ADMINISTRADOR);
}

function temAlgum(papeis: Papel[], alvo: Papel[]): boolean {
  return papeis.some((p) => alvo.includes(p));
}

/**
 * Reconstrói a URL canônica gravada nos agregados a partir dos segmentos da rota.
 * O POST /api/upload grava sempre `/api/files/<arquivo>`.
 */
export function urlCanonica(segmentos: string[]): string {
  return `/api/files/${segmentos.join("/")}`;
}

/**
 * Decide se `usuario` pode ler o arquivo identificado por `segmentos`.
 *
 * Regra: o arquivo é servível apenas se ALGUM agregado o referencia E o usuário tem
 * permissão de leitura sobre esse agregado (papel + escopo). Se nenhum agregado
 * referencia a URL, ninguém pode lê-la (false) — não vazamos arquivos órfãos.
 */
export async function podeLerArquivo(
  usuario: UsuarioArquivo,
  segmentos: string[],
): Promise<boolean> {
  const url = urlCanonica(segmentos);
  const admin = ehAdmin(usuario.papeis);

  // 1) Comprovante financeiro (Cobranca.comprovanteUrl)
  const cobranca = await prisma.cobranca.findFirst({
    where: { comprovanteUrl: url },
    select: { id: true },
  });
  if (cobranca) {
    return admin || temAlgum(usuario.papeis, PAPEIS_COMPROVANTE);
  }

  // 2) Documento do lead (Documento.url) — respeita o escopo do vendedor.
  const documento = await prisma.documento.findFirst({
    where: { url },
    select: { lead: { select: { vendedorDonoId: true } } },
  });
  if (documento) {
    if (admin || usuario.papeis.includes(Papel.GERENTE_COMERCIAL)) return true;
    if (usuario.papeis.includes(Papel.VENDEDOR)) {
      return documento.lead.vendedorDonoId === usuario.id;
    }
    return false;
  }

  // Nenhum agregado referencia este arquivo: negado.
  return false;
}
