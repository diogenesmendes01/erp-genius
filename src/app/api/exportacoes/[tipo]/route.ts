import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { exigirSessao, ErroAutenticacao, ErroPermissao, registrarEvento } from "@/server/_shared";
import { exigirCapacidade } from "@/server/_shared/capacidades";
import { listarAlunos, escopoAlunos } from "@/server/alunos/consultas";
import { listarLeads } from "@/server/comercial/consultas";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  try {
    const { tipo } = await params;
    if (tipo !== "alunos" && tipo !== "leads") return Response.json({ erro: "Exportação não encontrada." }, { status: 404 });
    const usuario = await exigirSessao();
    await exigirCapacidade(usuario, tipo === "alunos" ? "dados.exportar_alunos" : "dados.exportar_leads");
    const livro = new ExcelJS.Workbook();
    const folha = livro.addWorksheet(tipo === "alunos" ? "Alunos" : "Leads");
    const ids: string[] = [];
    // Somente colunas da listagem autorizada. Não usar objetos Prisma nem campos
    // fornecidos pelo cliente; strings são células de texto, nunca fórmulas.
    if (tipo === "alunos") {
      folha.columns = [{ header: "Código", key: "codigo", width: 18 }, { header: "Nome", key: "nome", width: 35 }, { header: "Situação", key: "status", width: 20 }, { header: "País", key: "pais", width: 25 }, { header: "Turma", key: "turma", width: 35 }];
      const dados = await listarAlunos(usuario);
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
    const permitidos = tipo === "alunos"
      ? await prisma.aluno.count({ where: { AND: [{ id: { in: ids } }, escopoAlunos(atual)] } })
      : await prisma.lead.count({ where: { AND: [{ id: { in: ids } }, await escopoComercialAtual(atual)] } });
    if (permitidos !== ids.length) throw new ErroPermissao("O acesso aos registros mudou durante a exportação. Gere uma nova planilha.");
    await prisma.$transaction(async (tx) => registrarEvento(tx, { tipo: "DadosExportados", agregadoTipo: "Exportacao", agregadoId: randomUUID(), autorId: atual.id, payload: { conjunto: tipo, quantidade: folha.rowCount - 1, colunas: folha.columns.map((c) => String(c.header)), filtros: {}, finalidade: "exportacao_da_listagem" } }));
    return new Response(arquivo, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${tipo}.xlsx"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (erro) {
    if (erro instanceof ErroAutenticacao) return Response.json({ erro: "Não autenticado." }, { status: 401 });
    if (erro instanceof ErroPermissao) return Response.json({ erro: erro.message }, { status: 403 });
    return Response.json({ erro: "Não foi possível gerar a planilha." }, { status: 500 });
  }
}
