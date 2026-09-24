import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { exigirSessao, ErroAutenticacao, ErroPermissao, registrarEvento } from "@/server/_shared";
import { exigirCapacidade } from "@/server/_shared/capacidades";
import { listarAlunos } from "@/server/alunos/consultas";
import { lerFiltrosAlunos } from "@/server/alunos/filtros";
import { listarLeads } from "@/server/comercial/consultas";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Inclui o vínculo de turma que compõe cada linha, não somente a identidade do aluno. */
function assinaturaDaProjecaoAlunos(alunos: Awaited<ReturnType<typeof listarAlunos>>) {
  return JSON.stringify([...alunos]
    .map(({ id, codigo, nome, status, pais, turmas }) => ({
      id, codigo, nome, status, pais,
      turmas: turmas.map(({ id: turmaId, label }) => ({ id: turmaId, label })).sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id)));
}

/** Filtros aplicados, para a trilha de auditoria — só os preenchidos. */
function filtrosRegistrados(f: ReturnType<typeof lerFiltrosAlunos> | null) {
  if (!f) return {};
  return Object.fromEntries(Object.entries({ busca: f.busca, status: f.status, paisId: f.paisId, turmaId: f.turmaId }).filter(([, v]) => v));
}

export async function GET(req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  try {
    const { tipo } = await params;
    if (tipo !== "alunos" && tipo !== "leads") return Response.json({ erro: "Exportação não encontrada." }, { status: 404 });
    const usuario = await exigirSessao();
    await exigirCapacidade(usuario, tipo === "alunos" ? "dados.exportar_alunos" : "dados.exportar_leads");
    const livro = new ExcelJS.Workbook();
    const folha = livro.addWorksheet(tipo === "alunos" ? "Alunos" : "Leads");
    const ids: string[] = [];
    let assinaturaAlunos: string | null = null;
    // Mesmo recorte da tela (E4): o link de exportação leva os filtros da lista. Só as chaves de
    // filtro são lidas e validadas (lerFiltrosAlunos); qualquer outra (colunas, ids…) é ignorada, e
    // a planilha sai inteira — sem paginação. Os filtros só estreitam o escopo do usuário.
    const filtrosAlunos = tipo === "alunos" ? { ...lerFiltrosAlunos(new URL(req.url).searchParams), pagina: 1 } : null;
    // Somente colunas da listagem autorizada. Não usar objetos Prisma nem campos
    // fornecidos pelo cliente; strings são células de texto, nunca fórmulas.
    if (tipo === "alunos") {
      folha.columns = [{ header: "Código", key: "codigo", width: 18 }, { header: "Nome", key: "nome", width: 35 }, { header: "Situação", key: "status", width: 20 }, { header: "País", key: "pais", width: 25 }, { header: "Turma", key: "turma", width: 35 }];
      const dados = await listarAlunos(usuario, filtrosAlunos!);
      assinaturaAlunos = assinaturaDaProjecaoAlunos(dados);
      for (const aluno of dados) { ids.push(aluno.id); folha.addRow({ codigo: aluno.codigo ?? "", nome: aluno.nome, status: aluno.status, pais: aluno.pais, turma: aluno.turmas.map((t) => t.label).join("; ") }); }
    } else {
      folha.columns = [{ header: "Código", key: "codigo", width: 18 }, { header: "Nome", key: "nome", width: 35 }, { header: "Etapa", key: "etapa", width: 25 }, { header: "Temperatura", key: "temperatura", width: 20 }];
      const dados = await listarLeads(usuario);
      for (const lead of dados) { ids.push(lead.id); folha.addRow({ codigo: lead.codigo ?? "", nome: lead.nome, etapa: lead.etapa, temperatura: lead.temperatura }); }
    }
    folha.getRow(1).font = { bold: true };
    folha.views = [{ state: "frozen", ySplit: 1 }];
    const arquivo = new Uint8Array(await livro.xlsx.writeBuffer());
    // Checa novamente antes de liberar a resposta gerada, inclusive se a permissão
    // foi revogada durante a geração. O arquivo não fica disponível em URL pública.
    const atual = await exigirSessao();
    await exigirCapacidade(atual, tipo === "alunos" ? "dados.exportar_alunos" : "dados.exportar_leads");
    if (atual.id !== usuario.id) throw new ErroPermissao();
    if (tipo === "alunos") {
      if (assinaturaAlunos !== assinaturaDaProjecaoAlunos(await listarAlunos(atual, filtrosAlunos!))) {
        throw new ErroPermissao("O acesso aos registros mudou durante a exportação. Gere uma nova planilha.");
      }
    } else {
      const permitidos = await prisma.lead.count({ where: { AND: [{ id: { in: ids } }, await escopoComercialAtual(atual)] } });
      if (permitidos !== ids.length) throw new ErroPermissao("O acesso aos registros mudou durante a exportação. Gere uma nova planilha.");
    }
    await prisma.$transaction(async (tx) => registrarEvento(tx, { tipo: "DadosExportados", agregadoTipo: "Exportacao", agregadoId: randomUUID(), autorId: atual.id, payload: { conjunto: tipo, quantidade: folha.rowCount - 1, colunas: folha.columns.map((c) => String(c.header)), filtros: filtrosRegistrados(filtrosAlunos), finalidade: "exportacao_da_listagem" } }));
    return new Response(arquivo, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${tipo}.xlsx"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (erro) {
    if (erro instanceof ErroAutenticacao) return Response.json({ erro: "Não autenticado." }, { status: 401 });
    if (erro instanceof ErroPermissao) return Response.json({ erro: erro.message }, { status: 403 });
    return Response.json({ erro: "Não foi possível gerar a planilha." }, { status: 500 });
  }
}
