import { mkdir, writeFile } from "node:fs/promises";
import { gerarPdfOriginal } from "../src/server/contratos/pdf-previa";
async function main() {
  const input = { previaId: "demonstracao-sem-dados-reais", criadaEm: new Date("2026-09-12T12:00:00Z"), conteudoHash: "a".repeat(64), snapshot: {
    modeloCodigo: "DEMONSTRACAO", modeloVersao: 1, condicoesVersao: 1, aplicacao: "Validação técnica com conteúdo fictício.",
    documento: { titulo: "Documento de demonstração - Escola de idiomas", campos: [], secoes: [
      { titulo: "1. Identificação fictícia", texto: "João Gonçalves e María Muñoz. Costa Rica e Brasil. Este arquivo contém somente dados inventados para testar acentos, paginação e legibilidade. Não constitui contrato da escola." },
      { titulo: "2. Texto longo para validar continuidade", texto: Array.from({ length: 16 }, (_, i) => `${i+1}. A equipe confere os dados da matrícula, a versão do modelo e as condições registradas. O aluno acompanha suas aulas e atividades. Esta frase serve somente para validar a quebra de linhas e páginas do documento gerado.`).join("\n\n") },
      { titulo: "3. Encerramento da demonstração", texto: "ÚLTIMO TRECHO PRESERVADO. Valor ilustrativo: 120.50 BRL. A assinatura e a ativação da matrícula não são comprovadas pela geração deste documento." },
    ] },
  } };
  const pdf = await gerarPdfOriginal(input), repetido = await gerarPdfOriginal(input);
  if (!pdf.bytes.equals(repetido.bytes)) throw new Error("PDF não determinístico para a mesma prévia");
  await mkdir("output/pdf", { recursive: true });
  await writeFile("output/pdf/original-contratual-demonstracao.pdf", pdf.bytes);
  await writeFile("docs/validacao-pdf-original-2026-09-12.json", JSON.stringify({ paginas: pdf.paginas, sha256: pdf.sha256, bytes: pdf.bytes.length, reproducaoIdentica: true, gerador: pdf.gerador, dados: "ficticios", inspecaoVisual: "pendente" }, null, 2));
  console.log(JSON.stringify({ paginas: pdf.paginas, bytes: pdf.bytes.length, sha256: pdf.sha256 }));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
