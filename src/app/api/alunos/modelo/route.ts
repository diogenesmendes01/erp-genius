import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Papel } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  COLUNAS_IMPORTACAO,
  EXEMPLO_LINHA,
  DROPDOWNS_IMPORTACAO,
  VALORES_GENERO,
  VALORES_ESCOLARIDADE,
  VALORES_SIM_NAO,
  VALORES_PAISES_ISO_NOMES,
} from "@/server/alunos/importacao";

// Modelo XLSX para cadastro de alunos em lote (recurso ADMIN). Colunas de lista fechada
// (enums Gênero/Escolaridade, sim/não, País, Tipo de documento, países ISO) viram DROPDOWN
// via data validation, com os valores numa aba auxiliar oculta ("Listas").
export const runtime = "nodejs";

const LINHAS_COM_DROPDOWN = 200; // dropdown disponível nas primeiras N linhas de dados

/** Coluna do Excel (1→A, 2→B, …, 27→AA). */
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

  // Listas dinâmicas (vêm do banco): mercados e tipos de documento distintos.
  const paises = await prisma.pais.findMany({
    orderBy: { nome: "asc" },
    include: { tiposDocumento: true },
  });
  const nomesPaises = paises.map((p) => p.nome);
  const tiposDoc = Array.from(new Set(paises.flatMap((p) => p.tiposDocumento.map((t) => t.nome)))).sort();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Alunos");
  ws.columns = COLUNAS_IMPORTACAO.map((c) => ({
    header: c.header + (c.obrig ? " *" : ""),
    key: c.key,
    width: Math.max(16, c.header.length + 4),
  }));
  ws.getRow(1).font = { bold: true };
  ws.addRow(EXEMPLO_LINHA);

  // Aba auxiliar com as listas (uma por coluna). Oculta — o admin não precisa vê-la.
  const listas = wb.addWorksheet("Listas");
  listas.state = "hidden";
  const LISTA_COL: Record<string, number> = {
    genero: 1,
    escolaridade: 2,
    simNao: 3,
    pais: 4,
    tipoDocumento: 5,
    iso: 6,
  };
  const dados: Record<string, string[]> = {
    genero: VALORES_GENERO,
    escolaridade: VALORES_ESCOLARIDADE,
    simNao: VALORES_SIM_NAO,
    pais: nomesPaises,
    tipoDocumento: tiposDoc.length ? tiposDoc : ["(sem tipos cadastrados)"],
    iso: VALORES_PAISES_ISO_NOMES,
  };
  // Cada lista vira um NOME DEFINIDO (named range) — referência de lista entre abas só
  // resolve no Excel via nome definido; range cru (Listas!$A$2:$A$4) sai com dropdown VAZIO.
  const NOME_LISTA: Record<string, string> = {
    genero: "Lista_genero",
    escolaridade: "Lista_escolaridade",
    simNao: "Lista_simNao",
    pais: "Lista_pais",
    tipoDocumento: "Lista_tipoDocumento",
    iso: "Lista_iso",
  };
  for (const [lista, col] of Object.entries(LISTA_COL)) {
    const valores = dados[lista];
    listas.getCell(1, col).value = lista; // rótulo (linha 1)
    valores.forEach((v, i) => {
      listas.getCell(i + 2, col).value = v;
    });
    const letra = colLetra(col);
    const fim = valores.length + 1; // valores começam na linha 2
    wb.definedNames.add(`Listas!$${letra}$2:$${letra}$${fim}`, NOME_LISTA[lista]);
  }

  // Aplica os dropdowns nas colunas da aba "Alunos" (linhas 2..N), referenciando o nome.
  for (const { key, lista } of DROPDOWNS_IMPORTACAO) {
    const idx = COLUNAS_IMPORTACAO.findIndex((c) => c.key === key);
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
      "Content-Disposition": 'attachment; filename="modelo-cadastro-alunos.xlsx"',
    },
  });
}
