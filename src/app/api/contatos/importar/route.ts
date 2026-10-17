import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { ErroAutenticacao, ErroPermissao, ErroRegra, exigirSessao } from "@/server/_shared/sessao";
import { exigirCapacidadeCrm } from "@/server/crm/permissoes";
import {
  MAX_BYTES_IMPORTACAO_CONTATOS as MAX_BYTES,
  MAX_LINHAS_IMPORTACAO_CONTATOS as MAX_LINHAS,
  aplicarLinhaContato,
  analisarPlanilhaContatos,
  chaveColuna,
  exigirDonoDaImportacao,
  previaContatos,
  registrarResumoImportacao,
} from "@/server/crm/importacao-contatos";

// Importação de contatos por XLSX (capacidade `contatos.importar`). "previa" só lê e valida; "aplicar" grava
// cada linha em transação própria (uma linha ruim não derruba as outras) e registra `ContatosImportados`
// só com contagens. Nenhum consentimento é importado e nenhuma mensagem é enviada.
export const runtime = "nodejs";

/** Coage qualquer tipo de célula do exceljs para texto (mesmo critério da importação de alunos). */
function cellTexto(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v && v.text != null) return String(v.text);
    if ("richText" in v && Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if ("result" in v && v.result != null) return String(v.result);
    return "";
  }
  return String(v);
}

const erro = (mensagem: string, status: number) => Response.json({ erro: mensagem }, { status });

export async function POST(req: Request) {
  try {
    const usuario = await exigirSessao();
    exigirCapacidadeCrm(usuario, "contatos.importar");

    if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return erro("Arquivo acima de 5MB.", 413);
    const form = await req.formData();
    const arquivo = form.get("arquivo");
    const modo = form.get("modo");
    if (modo !== "previa" && modo !== "aplicar") return erro("Modo inválido.", 400);
    if (!(arquivo instanceof File)) return erro("Arquivo ausente.", 400);
    if (arquivo.size > MAX_BYTES) return erro("Arquivo acima de 5MB.", 413);
    const donoId = String(form.get("donoId") ?? "").trim() || null;
    const ddi = String(form.get("ddi") ?? "").trim() || "+55";
    if (donoId) await exigirDonoDaImportacao(usuario, donoId);

    const livro = new ExcelJS.Workbook();
    try {
      await livro.xlsx.load(await arquivo.arrayBuffer());
    } catch {
      return erro("Não foi possível ler o arquivo. Use um .xlsx válido.", 400);
    }
    const folha = livro.worksheets[0];
    if (!folha || folha.rowCount < 2) return erro("Planilha vazia ou sem linhas de dados.", 400);
    if (folha.rowCount - 1 > MAX_LINHAS) return erro(`Planilha com muitas linhas (máx. ${MAX_LINHAS} por importação).`, 400);

    const colunas = new Map<number, NonNullable<ReturnType<typeof chaveColuna>>>();
    folha.getRow(1).eachCell((cel, col) => {
      const chave = chaveColuna(cellTexto(cel.value));
      if (chave) colunas.set(col, chave);
    });
    if (![...colunas.values()].includes("Nome")) return erro("Cabeçalho inválido. A coluna Nome é obrigatória.", 400);

    // Linhas em branco entram (para manter a numeração) e viram "Informe o nome." só se tiverem outro dado.
    const linhas: Record<string, string>[] = [];
    for (let r = 2; r <= folha.rowCount; r++) {
      const bruta: Record<string, string> = {};
      let vazia = true;
      colunas.forEach((chave, col) => {
        const t = cellTexto(folha.getRow(r).getCell(col).value).trim();
        if (t) vazia = false;
        bruta[chave] = t;
      });
      linhas.push(vazia ? { __vazia: "1" } : bruta);
    }
    const lidas = analisarPlanilhaContatos(linhas.map((l) => (l.__vazia ? {} : l)), ddi);
    const vazias = new Set(linhas.flatMap((l, i) => (l.__vazia ? [i + 2] : [])));
    const invalidas = lidas.invalidas.filter((i) => !vazias.has(i.linha));
    const { validas, repetidasNaPlanilha } = lidas;

    if (modo === "previa") {
      return Response.json({ modo, ...(await previaContatos(validas)), validas: validas.length, invalidas, repetidasNaPlanilha });
    }

    let novos = 0;
    let atualizados = 0;
    let comOportunidade = 0;
    const falhas = [...invalidas];
    for (const l of validas) {
      try {
        const r = await prisma.$transaction((tx) => aplicarLinhaContato(tx, l, usuario, donoId));
        if (r.criada) novos++;
        else atualizados++;
        if (r.oportunidade) comOportunidade++;
      } catch (e) {
        // Sem PII: só a linha e a classe/código do erro (ex.: P2002 de unicidade).
        const codigo = (e as { code?: unknown })?.code;
        console.error("[contatos/importar] falha na linha", {
          linha: l.linha,
          erro: e instanceof Error ? e.name : typeof e,
          codigo: typeof codigo === "string" ? codigo : undefined,
        });
        falhas.push({ linha: l.linha, motivo: "Não foi possível importar esta linha." });
      }
    }
    const resumo = { novos, atualizados, invalidos: falhas.length, comOportunidade };
    await prisma.$transaction((tx) => registrarResumoImportacao(tx, usuario.id, resumo));
    return Response.json({ modo, ...resumo, repetidasNaPlanilha, erros: falhas.sort((a, b) => a.linha - b.linha) });
  } catch (e) {
    if (e instanceof ErroAutenticacao) return erro("Não autenticado.", 401);
    if (e instanceof ErroPermissao) return erro(e.message, 403);
    if (e instanceof ErroRegra) return erro(e.message, 400);
    return erro("Não foi possível importar os contatos.", 500);
  }
}
