import { mkdir, writeFile } from "node:fs/promises";
import { gerarPdfOriginalAditivo } from "../src/server/contratos/pdf-previa";
async function main() {
  const input = { propostaId: "proposta-demonstracao", conferenciaId: "conferencia-demonstracao", conferenciaHash: "c".repeat(64),
    criadaEm: new Date("2026-09-15T12:00:00Z"), propostaHash: "a".repeat(64), modeloCodigo: "ADITIVO_DEMONSTRACAO", modeloVersao: 2, versaoProposta: 3, ambiente: "SANDBOX" as const,
    documento: { titulo: "Aditivo contratual - Demonstração técnica", campos: [], secoes: [
      { titulo: "1. Referências preservadas", texto: `Dados fictícios para verificar o gerador. Original documento-demonstracao - SHA-256 ${"b".repeat(64)}. Nenhum aditivo anterior. Este arquivo não constitui contrato da escola.` },
      { titulo: "2. Alteração e vigência", texto: "Anterior: João Gonçalves. Novo: João Gonçalves Muñoz. Vigência ilustrativa: 2026-10-01T03:00:00.000Z. A preservação do original não comprova assinatura nem aplica condições." },
      { titulo: "3. Continuidade e legibilidade", texto: Array.from({ length: 20 }, (_, i) => `${i + 1}. Conteúdo fictício para conferir a continuidade entre páginas, o rodapé, os acentos e a legibilidade: avaliação, compreensão, matrícula, María e Muñoz. As referências e condições precisam permanecer legíveis, com identificação do ambiente de teste em cada página.`).join("\n\n") },
      { titulo: "4. Encerramento da demonstração", texto: "ÚLTIMO TRECHO PRESERVADO. Assinaturas e aplicação são etapas posteriores. Não enviar este documento fictício para assinatura." },
    ] } };
  const pdf = await gerarPdfOriginalAditivo(input), repetido = await gerarPdfOriginalAditivo(input);
  if (!pdf.bytes.equals(repetido.bytes)) throw new Error("PDF não determinístico");
  await mkdir("output/pdf", { recursive: true }); await writeFile("output/pdf/original-aditivo-demonstracao.pdf", pdf.bytes);
  await writeFile("docs/validacao-visual-original-aditivo-496-2026-09-15.json", JSON.stringify({ paginas: pdf.paginas, sha256: pdf.sha256, bytes: pdf.bytes.length,
    reproducaoIdentica: true, dados: "ficticios", inspecaoVisual: "pendente" }, null, 2));
  console.log(JSON.stringify({ paginas: pdf.paginas, sha256: pdf.sha256 }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
