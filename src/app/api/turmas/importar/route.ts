import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Papel, StatusTurma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gerarCodigo } from "@/lib/codigo";
import { registrarEvento } from "@/server/_shared";
import { diasPorSemanaDaFrequencia, rotuloDiasHorario, emMinutos } from "@/server/turmas/schema";
import {
  chaveDoCabecalhoTurma,
  resolverBool,
  resolverData,
  resolverDiasSemana,
  resolverModalidade,
  resolverNivel,
  resolverProfessor,
} from "@/server/turmas/importacao";

// Importação de turmas por XLSX (recurso ADMIN — doc 12, evento `TurmaImportada`). Cada turma
// é criada na própria transação → uma linha ruim não derruba as demais (relatório por linha).
export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_LINHAS = 1000; // teto de linhas por importação (evita criação em massa acidental)
const HORARIO_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

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

export async function POST(req: Request) {
  const session = await auth();
  const papeis = (session?.user?.papeis ?? []) as Papel[];
  if (!session?.user?.id || !papeis.includes(Papel.ADMINISTRADOR)) {
    return NextResponse.json({ erro: "Apenas administrador pode importar turmas." }, { status: 403 });
  }
  // Guard de sessão órfã (autorId do Evento é FK de Usuario).
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

  const colKey = new Map<number, string>();
  ws.getRow(1).eachCell((cell, col) => {
    const k = chaveDoCabecalhoTurma(cellTexto(cell.value));
    if (k) colKey.set(col, k);
  });
  const chaves = new Set(colKey.values());
  if (!chaves.has("modalidade") || !chaves.has("nivel")) {
    return NextResponse.json(
      { erro: "Cabeçalho inválido. Baixe o modelo — são obrigatórias as colunas Modalidade e Nível." },
      { status: 400 },
    );
  }

  const [modalidades, niveis, professores] = await Promise.all([
    prisma.modalidade.findMany({ select: { id: true, nome: true, frequencia: true } }),
    prisma.nivel.findMany({ include: { idioma: { select: { nome: true } } } }),
    prisma.usuario.findMany({
      where: { papeis: { has: Papel.PROFESSOR }, ativo: true },
      select: { id: true, nome: true, email: true },
    }),
  ]);

  const erros: { linha: number; motivo: string }[] = [];
  let total = 0;
  let criadas = 0;

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

    const modalidade = resolverModalidade(raw.modalidade ?? "", modalidades);
    if (!modalidade) {
      erros.push({ linha: r, motivo: `Modalidade não reconhecida: "${raw.modalidade ?? ""}".` });
      continue;
    }
    const nivel = resolverNivel(raw.nivel ?? "", niveis);
    if (!nivel) {
      erros.push({ linha: r, motivo: `Nível não reconhecido: "${raw.nivel ?? ""}".` });
      continue;
    }
    // Professor é opcional; texto presente mas não encontrado é erro (evita silenciar engano).
    let professorId: string | null = null;
    if (raw.professor) {
      const prof = resolverProfessor(raw.professor, professores);
      if (!prof) {
        erros.push({ linha: r, motivo: `Professor não encontrado: "${raw.professor}".` });
        continue;
      }
      professorId = prof.id;
    }

    const diasSemana = resolverDiasSemana(raw.diasSemana);
    if (diasSemana.length === 0) {
      erros.push({ linha: r, motivo: `Dias da semana inválidos: "${raw.diasSemana ?? ""}".` });
      continue;
    }
    const req = diasPorSemanaDaFrequencia(modalidade.frequencia);
    if (req !== null && diasSemana.length !== req) {
      erros.push({
        linha: r,
        motivo: `${modalidade.nome} é ${modalidade.frequencia}: precisa de ${req} dia(s), veio ${diasSemana.length}.`,
      });
      continue;
    }

    const horarioInicio = raw.horarioInicio?.trim() ?? "";
    const horarioFim = raw.horarioFim?.trim() ?? "";
    if (!HORARIO_RE.test(horarioInicio) || !HORARIO_RE.test(horarioFim)) {
      erros.push({ linha: r, motivo: "Horário inválido (use HH:MM em início e fim)." });
      continue;
    }
    if (emMinutos(horarioFim) <= emMinutos(horarioInicio)) {
      erros.push({ linha: r, motivo: "Horário de fim deve ser depois do início." });
      continue;
    }

    const dataInicio = resolverData(raw.dataInicio);
    const dataFim = resolverData(raw.dataFim);
    if (!dataInicio || !dataFim) {
      erros.push({ linha: r, motivo: "Datas de início e fim são obrigatórias (AAAA-MM-DD)." });
      continue;
    }
    if (dataFim <= dataInicio) {
      erros.push({ linha: r, motivo: "Data de fim deve ser depois da data de início." });
      continue;
    }

    let capacidade = 12;
    if (raw.capacidade) {
      const cap = Number(raw.capacidade);
      if (!Number.isInteger(cap) || cap <= 0) {
        erros.push({ linha: r, motivo: `Capacidade inválida: "${raw.capacidade}" (use inteiro ≥ 1).` });
        continue;
      }
      capacidade = cap;
    }
    const rolling = resolverBool(raw.rolling) ?? false;
    const diasHorario = rotuloDiasHorario(diasSemana, horarioInicio, horarioFim);

    try {
      const codigo = await gerarCodigo("turma");
      await prisma.$transaction(async (tx) => {
        const turma = await tx.turma.create({
          data: {
            codigo,
            nome: raw.nome?.trim() || null,
            modalidadeId: modalidade.id,
            nivelId: nivel.id,
            professorId,
            diasSemana,
            horarioInicio,
            horarioFim,
            diasHorario,
            dataInicio,
            dataFim,
            capacidade,
            rolling,
            status: StatusTurma.PLANEJADA,
          },
        });
        await registrarEvento(tx, {
          tipo: "TurmaImportada",
          agregadoTipo: "Turma",
          agregadoId: turma.id,
          autorId: autor.id,
          payload: { origem: "xlsx", linha: r, codigo },
        });
      });
      criadas++;
    } catch {
      erros.push({ linha: r, motivo: "Falha ao gravar a linha no banco." });
    }
  }

  return NextResponse.json({ total, criadas, erros });
}
