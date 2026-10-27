import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Papel } from "@prisma/client";
import { exigirSessaoComPapel, ErroAutenticacao, ErroPermissao } from "@/server/_shared/sessao";
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
  try {
    await exigirSessaoComPapel(Papel.ADMINISTRADOR);
  } catch (erro) {
    if (erro instanceof ErroAutenticacao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
    if (erro instanceof ErroPermissao) return NextResponse.json({ erro: "Apenas administrador." }, { status: 403 });
    throw erro;
  }

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
    listas.getCell(1, col).value = lista;
    valores.forEach((v, i) => {
      listas.getCell(i + 2, col).value = v;
    });
    const letra = colLetra(col);
    const fim = valores.length + 1;
    wb.definedNames.add(`Listas!$${letra}$2:$${letra}$${fim}`, NOME_LISTA[lista]);
  }

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
