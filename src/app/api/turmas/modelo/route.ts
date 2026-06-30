import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Papel } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  COLUNAS_IMPORTACAO_TURMA,
  EXEMPLO_LINHA_TURMA,
  DROPDOWNS_TURMA,
  VALORES_SIM_NAO,
} from "@/server/turmas/importacao";

// Modelo XLSX para importar turmas em lote (recurso ADMIN). Colunas de lista fechada
// (modalidade, nível, professor, rolling) viram DROPDOWN via nome definido (named range),
// com os valores numa aba auxiliar oculta "Listas".
export const runtime = "nodejs";

const LINHAS_COM_DROPDOWN = 200;

function colLetra(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function GET() {
  const session = await auth();
  const papeis = (session?.user?.papeis ?? []) as Papel[];
  if (!session?.user?.id || !papeis.includes(Papel.ADMINISTRADOR)) {
    return NextResponse.json({ erro: "Apenas administrador." }, { status: 403 });
  }

  const [modalidades, niveis, professores] = await Promise.all([
    prisma.modalidade.findMany({ orderBy: { nome: "asc" }, select: { nome: true } }),
    prisma.nivel.findMany({ orderBy: [{ ordem: "asc" }], include: { idioma: true } }),
    prisma.usuario.findMany({
      where: { papeis: { has: Papel.PROFESSOR }, ativo: true },
      orderBy: { nome: "asc" },
      select: { nome: true },
    }),
  ]);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Turmas");
  ws.columns = COLUNAS_IMPORTACAO_TURMA.map((c) => ({
    header: c.header + (c.obrig ? " *" : ""),
    key: c.key,
    width: Math.max(16, c.header.length + 4),
  }));
  ws.getRow(1).font = { bold: true };
  ws.addRow(EXEMPLO_LINHA_TURMA);

  const listas = wb.addWorksheet("Listas");
  listas.state = "hidden";
  const LISTA_COL: Record<string, number> = { modalidade: 1, nivel: 2, professor: 3, simNao: 4 };
  const dados: Record<string, string[]> = {
    modalidade: modalidades.map((m) => m.nome),
    nivel: niveis.map((n) => `${n.idioma.nome} ${n.codigo}`),
    professor: professores.length ? professores.map((p) => p.nome) : ["(sem professores)"],
    simNao: VALORES_SIM_NAO,
  };
  const NOME_LISTA: Record<string, string> = {
    modalidade: "Lista_modalidade",
    nivel: "Lista_nivel",
    professor: "Lista_professor",
    simNao: "Lista_simNao",
  };
  for (const [lista, col] of Object.entries(LISTA_COL)) {
    const valores = dados[lista];
    listas.getCell(1, col).value = lista;
    valores.forEach((v, i) => {
      listas.getCell(i + 2, col).value = v;
    });
    const letra = colLetra(col);
    wb.definedNames.add(`Listas!$${letra}$2:$${letra}$${valores.length + 1}`, NOME_LISTA[lista]);
  }

  for (const { key, lista } of DROPDOWNS_TURMA) {
    const idx = COLUNAS_IMPORTACAO_TURMA.findIndex((c) => c.key === key);
    if (idx < 0) continue;
    for (let r = 2; r <= LINHAS_COM_DROPDOWN + 1; r++) {
      ws.getCell(r, idx + 1).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [NOME_LISTA[lista]],
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: "Valor fora da lista",
        error: "Escolha um valor da lista (ou deixe em branco).",
      };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-importar-turmas.xlsx"',
    },
  });
}
