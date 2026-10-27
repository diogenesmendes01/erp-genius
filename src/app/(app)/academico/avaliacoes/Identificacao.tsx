import { IdentificacaoRegistro } from "@/components/IdentificacaoRegistro";

export function IdentificacaoAvaliacao({ dados }: { dados: { aluno: string; matriculaId: string; matriculaCodigo: string | null; oferta: string; turma: string; nivel: string } }) {
  return <IdentificacaoRegistro rotulo="Aluno e matrícula desta avaliação" dados={{
    aluno: dados.aluno, matriculaCodigo: dados.matriculaCodigo, matriculaComplemento: dados.oferta, registro: [`${dados.turma} · nível ${dados.nivel}`],
  }} />;
}
