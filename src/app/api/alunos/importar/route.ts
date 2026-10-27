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
import {
  carregarCadastradosParaDuplicidade,
  chavesDeIdentidade,
  motivoDuplicidade,
  type IdentidadeAluno,
} from "@/server/alunos/importacao-duplicidade";

export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_LINHAS = 1000;

type PaisComDocs = Prisma.PaisGetPayload<{ include: { tiposDocumento: true } }>;

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
  if (!session?.user?.id) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  const autor = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, papeis: true, ativo: true },
  });
  if (!autor || !autor.ativo) {
    return NextResponse.json({ erro: "Sessão expirada. Saia e entre novamente." }, { status: 401 });
  }
  if (!autor.papeis.includes(Papel.ADMINISTRADOR)) {
    return NextResponse.json({ erro: "Apenas administrador pode importar alunos." }, { status: 403 });
  }

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
  const ignorados: { linha: number; motivo: string }[] = [];
  let total = 0;
  let criados = 0;

  type LinhaPreparada = {
    linha: number;
    raw: Record<string, string>;
    primeiroNome: string;
    pais: PaisComDocs;
    tipoDoc: PaisComDocs["tiposDocumento"][number] | undefined;
    documentoValido: boolean;
    identidade: IdentidadeAluno;
  };
  const preparadas: LinhaPreparada[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const raw: Record<string, string> = {};
    let vazia = true;
    colKey.forEach((key, col) => {
      const t = cellTexto(row.getCell(col).value).trim();
      if (t) vazia = false;
      raw[key] = t;
    });
    if (vazia) continue;
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
    preparadas.push({
      linha: r, raw, primeiroNome, pais, tipoDoc, documentoValido,
      identidade: {
        paisId: pais.id,
        primeiroNome,
        sobrenome: raw.sobrenome?.trim() || null,
        documento,
        email: raw.email?.trim() || null,
        telefoneE164: normalizarTelefoneE164(raw.telefone, pais.ddi),
        nascimento: resolverData(raw.nascimento),
      },
    });
  }

  const indice = await carregarCadastradosParaDuplicidade(preparadas.map((p) => p.identidade));

  for (const { linha: r, raw, primeiroNome, pais, tipoDoc, documentoValido, identidade } of preparadas) {
    const chaves = chavesDeIdentidade(identidade);
    const repetida = indice.procurar(chaves);
    if (repetida) {
      ignorados.push({ linha: r, motivo: motivoDuplicidade(repetida.origem, repetida.criterio) });
      continue;
    }
    try {
      const codigo = await gerarCodigo("aluno");
      await prisma.$transaction(async (tx) => {
        const aluno = await tx.aluno.create({
          data: {
            codigo,
            primeiroNome,
            sobrenome: identidade.sobrenome,
            nomePreferido: raw.nomePreferido?.trim() || null,
            nascimento: identidade.nascimento,
            genero: resolverGenero(raw.genero),
            paisId: pais.id,
            tipoDocumentoId: tipoDoc?.id ?? null,
            documento: identidade.documento,
            documentoValido,
            documentoPaisEmissor: resolverISO(raw.documentoPaisEmissor),
            nacionalidade: resolverISO(raw.nacionalidade),
            segundaNacionalidade: resolverISO(raw.segundaNacionalidade),
            email: identidade.email,
            telefoneE164: identidade.telefoneE164,
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
      indice.registrar(chaves, { tipo: "planilha", linha: r });
    } catch {
      erros.push({ linha: r, motivo: "Falha ao gravar a linha no banco." });
    }
  }
  erros.sort((a, b) => a.linha - b.linha);

  return NextResponse.json({ total, criados, erros, ignorados });
}
