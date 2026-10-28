export type SugestaoNovoCadastro = {
  primeiroNome: string;
  sobrenome: string;
  email: string;
  paisId: string;
};

export function sugestaoNovoCadastroDoLead(lead: {
  nome: string;
  paisId: string | null;
  pessoa: { nome: string; email: string | null } | null;
}): SugestaoNovoCadastro {
  const nome = (lead.pessoa?.nome || lead.nome).trim();
  const partes = nome.split(/\s+/).filter(Boolean);
  return {
    primeiroNome: partes[0] ?? "",
    sobrenome: partes.slice(1).join(" "),
    email: lead.pessoa?.email ?? "",
    paisId: lead.paisId ?? "",
  };
}
