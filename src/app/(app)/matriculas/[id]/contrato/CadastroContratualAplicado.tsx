const rotulos: Record<string, string> = {
  ALUNO_NOME: "Nome do aluno", ALUNO_DOCUMENTO: "Documento do aluno",
  ALUNO_EMAIL: "E-mail do aluno", ALUNO_ENDERECO: "Endereço do aluno",
  PAGADOR_NOME: "Nome do responsável financeiro", PAGADOR_DOCUMENTO: "Documento do responsável financeiro",
  PAGADOR_EMAIL: "E-mail do responsável financeiro", PAGADOR_ENDERECO: "Endereço do responsável financeiro",
};

export function CadastroContratualAplicado({ cadastro }: { cadastro: {
  versao: number; vigenciaInicio: string; estado: "PROGRAMADO" | "VIGENCIA_INICIADA";
  campos: Partial<Record<string, string>>;
} | null | undefined }) {
  if (!cadastro) return null;
  const campos = Object.entries(cadastro.campos).filter(([campo, valor]) => rotulos[campo] && valor !== undefined);
  if (!campos.length) return null;
  return <section className="space-y-2 rounded border p-4" aria-label="Cadastro contratual da versão aplicada">
    <h2 className="text-xl">Cadastro contratual · versão {cadastro.versao}</h2>
    <p>{cadastro.estado === "PROGRAMADO" ? "Vigência programada" : "Vigência iniciada"}: {cadastro.vigenciaInicio.replace("T", " ").replace("Z", " UTC")}.</p>
    <p>Dados preservados nesta versão do contrato. Versões posteriores podem substituí-los. O cadastro geral e a conta de acesso do aluno permanecem separados.</p>
    <dl>{campos.map(([campo, valor]) => <div key={campo} className="py-1"><dt className="font-medium">{rotulos[campo]}</dt><dd className="whitespace-pre-wrap">{valor}</dd></div>)}</dl>
  </section>;
}
