import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Papel, StatusAluno, type Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gerarCodigo } from "@/lib/codigo";
import { registrarEvento, normalizarTelefoneE164, validarDocumento } from "@/server/_shared";
import {
  chaveDoCabecalho,
  normalizarChave,
  resolverGenero,
  resolverEscolaridade,
  resolverBool,
  resolverISO,
  resolverData,
} from "@/server/alunos/importacao";

// Importação de alunos por planilha XLSX (recurso ADMIN — doc 22, evento `AlunoImportado`).
// Lenient: só Nome + País obrigatórios; documento avisa-não-bloqueia. Cada aluno é criado
// em sua própria transação → uma linha ruim não derruba as demais (relatório por linha).
export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_LINHAS = 1000; // teto de linhas por importação (evita criação em massa acidental)

type PaisComDocs = Prisma.PaisGetPayload<{ include: { tiposDocumento: true } }>;

/** Coage qualquer tipo de célula do exceljs para texto. */
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

function resolverPais(valor: string, paises: PaisComDocs[]): PaisComDocs | null {
  const alvo = normalizarChave(valor);
  if (!alvo) return null;
  return (
    paises.find((p) => normalizarChave(p.nome) === alvo || p.codigoISO.toLowerCase() === alvo) ?? null
  );
}

export async function POST(req: Request) {
  const session = await auth();
  const papeis = (session?.user?.papeis ?? []) as Papel[];
  if (!session?.user?.id || !papeis.includes(Papel.ADMINISTRADOR)) {
    return NextResponse.json({ erro: "Apenas administrador pode importar alunos." }, { status: 403 });
  }
  // Guard de sessão órfã: o autorId do Evento é FK de Usuario — se a sessão (JWT) tem um
  // id que não existe neste banco, falha com FK críptica. Detecta e orienta o re-login.
  const autor = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!autor) {
    return NextResponse.json({ erro: "Sessão expirada. Saia e entre novamente." }, { status: 401 });
  }

  // Rejeita cedo, antes de bufferizar o multipart inteiro em memória.
  const tamanho = Number(req.headers.get("content-length") ?? 0);
  if (tamanho > MAX_BYTES) {
    return NextResponse.json({ erro: "Arquivo acima de 5MB." }, { status: 413 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ erro: "Arquivo ausente." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ erro: "Arquivo acima de 5MB." }, { status: 400 });
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ erro: "Não foi possível ler o arquivo. Use um .xlsx válido." }, { status: 400 });
  }
  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 2) {
    return NextResponse.json({ erro: "Planilha vazia ou sem linhas de dados." }, { status: 400 });
  }
  if (ws.rowCount - 1 > MAX_LINHAS) {
    return NextResponse.json(
      { erro: `Planilha com muitas linhas (máx. ${MAX_LINHAS} por importação).` },
      { status: 400 },
    );
  }

  // Cabeçalho (linha 1) → coluna → chave interna.
  const colKey = new Map<number, string>();
  ws.getRow(1).eachCell((cell, col) => {
    const k = chaveDoCabecalho(cellTexto(cell.value));
    if (k) colKey.set(col, k);
  });
  const chaves = new Set(colKey.values());
  if (!chaves.has("primeiroNome") || !chaves.has("pais")) {
    return NextResponse.json(
      { erro: "Cabeçalho inválido. Baixe o modelo — são obrigatórias as colunas Nome e País." },
      { status: 400 },
    );
  }

  const paises = await prisma.pais.findMany({ include: { tiposDocumento: true } });

  const erros: { linha: number; motivo: string }[] = [];
  let total = 0;
  let criados = 0;

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const raw: Record<string, string> = {};
    let vazia = true;
    colKey.forEach((key, col) => {
      const t = cellTexto(row.getCell(col).value).trim();
      if (t) vazia = false;
      raw[key] = t;
    });
    if (vazia) continue; // ignora linhas em branco
    total++;

    const primeiroNome = raw.primeiroNome?.trim();
    if (!primeiroNome) {
      erros.push({ linha: r, motivo: "Nome (obrigatório) está vazio." });
      continue;
    }
    const pais = resolverPais(raw.pais ?? "", paises);
    if (!pais) {
      erros.push({ linha: r, motivo: `País não reconhecido: "${raw.pais ?? ""}".` });
      continue;
    }

    const tipoDoc = raw.tipoDocumento
      ? pais.tiposDocumento.find((t) => normalizarChave(t.nome) === normalizarChave(raw.tipoDocumento))
      : undefined;
    const documento = raw.documento?.trim() || null;
    const documentoValido = documento && tipoDoc ? validarDocumento(tipoDoc.validador, documento) : false;

    try {
      const codigo = await gerarCodigo("aluno");
      await prisma.$transaction(async (tx) => {
        const aluno = await tx.aluno.create({
          data: {
            codigo,
            primeiroNome,
            sobrenome: raw.sobrenome?.trim() || null,
            nomePreferido: raw.nomePreferido?.trim() || null,
            nascimento: resolverData(raw.nascimento),
            genero: resolverGenero(raw.genero),
            paisId: pais.id,
            tipoDocumentoId: tipoDoc?.id ?? null,
            documento,
            documentoValido,
            documentoPaisEmissor: resolverISO(raw.documentoPaisEmissor),
            nacionalidade: resolverISO(raw.nacionalidade),
            segundaNacionalidade: resolverISO(raw.segundaNacionalidade),
            email: raw.email?.trim() || null,
            telefoneE164: normalizarTelefoneE164(raw.telefone, pais.ddi),
            whatsapp: resolverBool(raw.whatsapp) ?? false,
            aceitaComunicacoes: resolverBool(raw.aceitaComunicacoes) ?? true,
            paisResidencia: resolverISO(raw.paisResidencia),
            cep: raw.cep?.trim() || null,
            rua: raw.rua?.trim() || null,
            numero: raw.numero?.trim() || null,
            complemento: raw.complemento?.trim() || null,
            bairro: raw.bairro?.trim() || null,
            cidade: raw.cidade?.trim() || null,
            regiao: raw.regiao?.trim() || null,
            escolaridade: resolverEscolaridade(raw.escolaridade),
            idiomaNativo: raw.idiomaNativo?.trim() || null,
            fuso: raw.fuso?.trim() || null,
            observacoes: raw.observacoes?.trim() || null,
            status: StatusAluno.ATIVO,
          },
        });
        await registrarEvento(tx, {
          tipo: "AlunoImportado",
          agregadoTipo: "Aluno",
          agregadoId: aluno.id,
          autorId: autor.id,
          payload: { origem: "xlsx", linha: r, codigo },
        });
      });
      criados++;
    } catch {
      erros.push({ linha: r, motivo: "Falha ao gravar a linha no banco." });
    }
  }

  return NextResponse.json({ total, criados, erros });
}
