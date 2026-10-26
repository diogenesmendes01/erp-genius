/** Snapshot construído SOMENTE por consultas do servidor com escopo fresco; nunca input/DTO do cliente. */
export interface CadastroTelefoneInterno {
 oportunidadesAutorizadas: readonly { id: string; telefoneE164: string|null }[];
 pessoaIdentificada: boolean; alunoIdentificado: boolean; responsavelIdentificado: boolean;
 contatoIdentificado: boolean; oportunidadeOcultaIdentificada: boolean;
}
export type AlvoNovaConversaInterna = { tipo: "novo" } | { tipo: "existente"; leadId: string } | { tipo: "recusar" };
/** Classifica o alvo; NÃO autoriza operação nem valida bindings de Contato/Conversa. */
export function classificarAlvoNovaConversa(entrada: { telefoneE164: string; leadEsperadoId?: string }, cadastro: CadastroTelefoneInterno): AlvoNovaConversaInterna {
 const oportunidades = cadastro.oportunidadesAutorizadas;
 // Uma projeção inconsistente não pode ser descartada para fingir que o telefone é novo.
 if (oportunidades.some(o => o.telefoneE164 !== entrada.telefoneE164)) return { tipo: "recusar" };
 if (entrada.leadEsperadoId !== undefined) {
  const alvo = oportunidades.find(o => o.id === entrada.leadEsperadoId);
  return alvo ? { tipo: "existente", leadId: alvo.id } : { tipo: "recusar" };
 }
 if (oportunidades.length === 1) return { tipo: "existente", leadId: oportunidades[0].id };
 if (oportunidades.length > 1 || cadastro.pessoaIdentificada || cadastro.alunoIdentificado || cadastro.responsavelIdentificado || cadastro.contatoIdentificado || cadastro.oportunidadeOcultaIdentificada) return { tipo: "recusar" };
 return { tipo: "novo" };
}
