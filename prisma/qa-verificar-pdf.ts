// Verificação de QA: renderiza, pela rota real, o PDF dos originais contratuais (contratos) dos alunos de QA.
// Roda como os seeds (TSX_TSCONFIG_PATH=prisma/tsconfig.seed-qa.json); não altera dados.
import { PrismaClient } from "@prisma/client";
import { GET } from "@/app/api/matriculas/[id]/originais/[artefatoId]/pdf/route";
declare global { var __qaSessao: string | undefined } // eslint-disable-line no-var
const prisma = new PrismaClient();
async function main() {
  const adm = await prisma.usuario.findFirstOrThrow({ where: { email: "admin@genius.com" } });
  globalThis.__qaSessao = adm.id;
  const artefatos = await prisma.artefatoContratual.findMany({ where: { previa: { matricula: { aluno: { id: { startsWith: "qa_" } } } } }, select: { id: true, previa: { select: { matriculaId: true } } } });
  let ok = 0;
  for (const a of artefatos) {
    const r = await GET(new Request("http://qa/pdf"), { params: Promise.resolve({ id: a.previa.matriculaId, artefatoId: a.id }) });
    const b = Buffer.from(await r.arrayBuffer());
    const valido = r.status === 200 && r.headers.get("content-type") === "application/pdf" && b.subarray(0, 5).toString() === "%PDF-";
    if (valido) ok++; else console.log(`Falhou ${a.id}: HTTP ${r.status}`);
  }
  console.log(`PDFs de originais renderizados: ${ok}/${artefatos.length}`);
}
main().finally(() => prisma.$disconnect());
