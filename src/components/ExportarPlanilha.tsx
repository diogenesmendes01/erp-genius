import { Papel } from "@prisma/client";
import { exigirSessao, temPermissao } from "@/server/_shared";
import { botaoClasses } from "./Botao";

/**
 * Link só aparece para quem tem a concessão; a rota revalida independentemente.
 * `query`: os filtros da tela (E4) — a planilha sai com o mesmo recorte que o operador vê.
 */
export async function ExportarPlanilha({ tipo, query = "" }: { tipo: "alunos" | "leads"; query?: string }) {
  const usuario = await exigirSessao();
  if (!usuario.papeis.includes(Papel.ADMINISTRADOR) && !temPermissao(usuario, `dados.exportar_${tipo}`)) return null;
  const href = `/api/exportacoes/${tipo}${query ? `?${query}` : ""}`;
  return <a href={href} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{query ? "Exportar planilha (filtros aplicados)" : "Exportar planilha"}</a>;
}
