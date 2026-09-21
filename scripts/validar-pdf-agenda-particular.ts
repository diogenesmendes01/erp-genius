import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gerarPdfPrevia } from "../src/server/contratos/pdf-previa";
import { formatarAgendaParticular } from "../src/server/contratos/agenda-particular-texto";
async function main() {
  const encontros = Array.from({ length: 24 }, (_, i) => {
    const inicio = new Date(Date.UTC(2099, 9, 2 + i * 7, 2, 30));
    return { inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + 90 * 60000).toISOString(), professorNome: i % 2 ? "María Muñoz González" : "João Gonçalves da Conceição" };
  });
  const fixa = formatarAgendaParticular({ formaAgenda: "PARTICULAR_GRADE_FIXA", fusoOrigem: "America/Sao_Paulo", horarios: encontros });
  const flexivel = formatarAgendaParticular({ formaAgenda: "PARTICULAR_FLEXIVEL", fusoOrigem: "America/Costa_Rica", horarios: [{ inicio: "2099-10-05T21:00:00.000Z", fim: "2099-10-05T22:15:00.000Z", professorNome: "María Muñoz González" }] });
  const snapshot = { modeloCodigo: "DEMONSTRACAO_AGENDA", modeloVersao: 1, condicoesVersao: 1, aplicacao: "Dados inventados para validação técnica.", documento: { titulo: "Agenda particular - demonstração de PDF", campos: [], secoes: [
    { titulo: "1. Finalidade desta demonstração", texto: "Este arquivo usa dados fictícios e reúne cenários separados de teste. Não é um contrato da escola. Verifica texto, acentuação, duração, fusos e continuidade da paginação." },
    { titulo: "2. Cenário de grade fixa: encontros que atravessam meia-noite", texto: fixa },
    { titulo: "3. Cenário independente de agenda flexível", texto: flexivel },
    { titulo: "4. Fim da verificação", texto: "ÚLTIMO TRECHO PRESERVADO. Gravação, cobrança, assinatura e ativação não são comprovadas por esta demonstração." },
  ] } };
  const input = { previaId: "demonstracao-agenda-particular", criadaEm: new Date("2026-09-12T12:00:00Z"), conteudoHash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"), snapshot };
  const pdf = await gerarPdfPrevia(input), repetido = await gerarPdfPrevia(input);
  if (!pdf.bytes.equals(repetido.bytes)) throw new Error("Reprodução divergente");
  await mkdir("output/pdf", { recursive: true });
  await writeFile("output/pdf/agenda-particular-demonstracao.pdf", pdf.bytes);
  await writeFile("docs/validacao-pdf-agenda-214-2026-09-12.json", JSON.stringify({ incremento: 214, paginas: pdf.paginas, bytes: pdf.bytes.length, sha256: pdf.sha256, reproducaoIdentica: true, dados: "ficticios", encontrosFixos: encontros.length, encontroFlexivel: 1, inspecaoVisual: "pendente", extracao: "pendente" }, null, 2));
  console.log(JSON.stringify({ paginas: pdf.paginas, bytes: pdf.bytes.length, sha256: pdf.sha256 }));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
