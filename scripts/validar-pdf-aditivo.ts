import { mkdir, writeFile } from "node:fs/promises";
import { gerarPdfPreviaAditivo } from "../src/server/contratos/pdf-previa";

async function main() {
  const input = {
    propostaId: "aditivo-demonstracao-sem-dados-reais", criadaEm: new Date("2026-09-15T12:00:00Z"), propostaHash: "a".repeat(64),
    modeloCodigo: "ADITIVO_DEMONSTRACAO", modeloVersao: 2, versaoProposta: 3, ambiente: "SANDBOX" as const,
    documento: { titulo: "Prévia de aditivo - Demonstração técnica", campos: [], secoes: [
      { titulo: "1. Referências preservadas", texto: `Somente dados fictícios. Este documento testa o gerador e não é um contrato da escola.\nOriginal: documento-demonstracao - SHA-256 ${"b".repeat(64)}\nNenhum aditivo anterior vinculado.` },
      { titulo: "2. Condições propostas e vigência", texto: "Nome fictício do participante\nCondição anterior: João Gonçalves\nNova condição: João Gonçalves Muñoz\nVigência ilustrativa: 2026-10-01T03:00:00.000Z. A proposta não comprova assinatura nem aplica condições." },
      { titulo: "3. Continuidade do conteúdo", texto: Array.from({ length: 20 }, (_, i) => `${i + 1}. Conteúdo fictício para conferir continuidade da página, acentos em português e espanhol e legibilidade: avaliação, compreensão, matrícula, María e Muñoz. Os valores anteriores, as alterações propostas e as referências documentais precisam permanecer legíveis no arquivo. Este texto não define condições contratuais.`).join("\n\n") },
      { titulo: "4. Fim da demonstração", texto: "ÚLTIMO TRECHO PRESERVADO. A decisão administrativa, a assinatura e a aplicação são etapas distintas. Esta prévia não substitui nenhuma delas." },
    ] },
  };
  const pdf = await gerarPdfPreviaAditivo(input), repetido = await gerarPdfPreviaAditivo(input);
  if (!pdf.bytes.equals(repetido.bytes)) throw new Error("PDF não determinístico");
  await mkdir("output/pdf", { recursive: true });
  await writeFile("output/pdf/previa-aditivo-demonstracao.pdf", pdf.bytes);
  await writeFile("docs/validacao-visual-pdf-aditivo-493-2026-09-15.json", JSON.stringify({ paginas: pdf.paginas,
    sha256: pdf.sha256, bytes: pdf.bytes.length, reproducaoIdentica: true, dados: "ficticios", inspecaoVisual: "pendente" }, null, 2));
  console.log(JSON.stringify({ paginas: pdf.paginas, bytes: pdf.bytes.length, sha256: pdf.sha256 }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
