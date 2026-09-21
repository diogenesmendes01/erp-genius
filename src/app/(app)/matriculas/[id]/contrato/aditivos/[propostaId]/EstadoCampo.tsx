export function EstadoCampo({ aplicada, exigeAcerto }: { aplicada: boolean; exigeAcerto: boolean }) {
  return <p role="status">{aplicada ? "Aplicação registrada para esta condição; respeitar a vigência aprovada." : exigeAcerto ? "Aplicação pendente: exige acerto próprio aprovado." : "Aplicação desta condição ainda pendente."}</p>;
}
