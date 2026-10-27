import type { UsuarioSessao } from "@/server/_shared/sessao";
import { ETAPA_LABEL, ORIGEM_CANAL_LABEL, rotular } from "@/lib/labels";
import { exigirCapacidadeCrm } from "./permissoes";
import { listarContatos, type FiltrosContatos } from "./contatos";

export const COLUNAS_EXPORTACAO_CONTATOS = ["Código", "Nome", "Tipo", "Cidade", "Origem", "Tags", "Etapa", "Responsável"] as const;

export function celulaSegura(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export async function linhasExportacaoContatos(
  usuario: UsuarioSessao,
  filtros: FiltrosContatos,
): Promise<{ ids: string[]; linhas: string[][] }> {
  exigirCapacidadeCrm(usuario, "contatos.ver");
  const ids: string[] = [];
  const linhas: string[][] = [];
  for (let pagina = 1; ; pagina++) {
    const { itens, possuiMais } = await listarContatos(usuario, { ...filtros, pagina });
    for (const c of itens) {
      ids.push(`${c.tipo}:${c.id}`);
      linhas.push([
        c.codigo ?? "",
        c.nome,
        c.tipo === "pessoa" ? "Pessoa" : "Empresa",
        c.cidade ?? "",
        c.origem ? rotular(ORIGEM_CANAL_LABEL, c.origem) : "",
        c.tags.map((t) => t.nome).join("; "),
        c.oportunidade ? rotular(ETAPA_LABEL, c.oportunidade.etapa) : "",
        c.oportunidade?.dono ?? "",
      ].map(celulaSegura));
    }
    if (!possuiMais || !itens.length) break;
  }
  return { ids, linhas };
}
