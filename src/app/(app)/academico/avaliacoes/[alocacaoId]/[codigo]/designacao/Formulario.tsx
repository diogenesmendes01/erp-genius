"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { designarAvaliador } from "@/server/avaliacoes/designacao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
import { MensagemStatus } from "@/components/MensagemStatus";
import { CampoCombobox } from "@/app/(app)/academico/controles";

type Professor = { id: string; nome: string };
const normal = (t: string) => t.trim().toLocaleLowerCase("pt-BR");

export function professoresDaBusca(professores: Professor[], buscaServidor: string, refinarBusca: boolean, termo: string): { lista: Professor[]; local: boolean } {
  const local = !refinarBusca && normal(termo).includes(normal(buscaServidor));
  return { local, lista: local ? professores.filter(p => normal(p.nome).includes(normal(termo))) : professores };
}

export function FormularioDesignacao({ alocacaoId, codigoAvaliacao, versaoEsperada, atualId, professores, busca = "", refinarBusca = false }: {
  alocacaoId: string; codigoAvaliacao: string; versaoEsperada: number; atualId: string | null; professores: Professor[];
  busca?: string;
  refinarBusca?: boolean;
}) {
  const router = useRouter(), chave = useRef<string | null>(null);
  const [professor, setProfessor] = useState(""), [motivo, setMotivo] = useState("");
  const [escolhido, setEscolhido] = useState<Professor | null>(null);
  const [termo, setTermo] = useState(busca);
  const acao = useAcaoCliente({ idempotente: true });
  const { lista, local } = professoresDaBusca(professores, busca, refinarBusca, termo);
  const opcoes = lista.filter(p => p.id !== atualId);
  const manter = escolhido && escolhido.id === professor && !opcoes.some(p => p.id === escolhido.id) ? escolhido : null;
  const buscar = () => router.replace(`?busca=${encodeURIComponent(termo.trim())}`, { scroll: false });
  return <form className="space-y-3 rounded border p-4" onSubmit={async e => {
    e.preventDefault(); if (!professor) return;
    const chaveIdempotencia = (chave.current ??= crypto.randomUUID());
    const d = await acao.executar(() => designarAvaliador({ alocacaoId, codigoAvaliacao, versaoEsperada, professorId: professor === "revogar" ? null : professor, motivo, chaveIdempotencia }), "Designação registrada.");
    if (d?.tipo === "ok") { chave.current = null; setProfessor(""); setMotivo(""); setEscolhido(null); router.refresh(); }
  }}>
    <fieldset disabled={acao.ocupado} className="space-y-3">
      <legend className="font-medium">Alterar responsável pela avaliação</legend>
      <div className="space-y-2">
        <label className="block">Buscar professor por nome<input type="search" maxLength={100} value={termo} onChange={e => setTermo(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }} className="block rounded border p-2" /></label>
        <button type="button" onClick={buscar} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Buscar</button>
        <p className="text-sm">{local ? "A lista abaixo já está filtrada pelo nome digitado." : "Clique em Buscar para atualizar a lista."} O motivo digitado continua no formulário.</p>
        <MensagemStatus texto={refinarBusca ? "Exibindo os primeiros 50 professores. Refine a busca para localizar o nome desejado." : null} />
      </div>
      <label className="block">Professor ou revogação<CampoCombobox required className="block rounded border p-2" value={professor} onChange={e => {
        const id = e.target.value;
        setProfessor(id); chave.current = null;
        setEscolhido(professores.find(p => p.id === id) ?? (escolhido?.id === id ? escolhido : null));
      }} placeholder="Selecione uma opção" opcoes={[...(atualId ? [{ valor: "revogar", rotulo: "Revogar a designação atual" }] : []), ...(manter ? [{ valor: manter.id, rotulo: manter.nome }] : []), ...opcoes.map(p => ({ valor: p.id, rotulo: p.nome }))]} /></label>
      <label className="block">Motivo<CampoTexto required minLength={5} maxLength={2000} value={motivo} className="block w-full rounded border p-2" onChange={e => { setMotivo(e.target.value); chave.current = null; }} /></label>
      <button disabled={!professor} className={botaoClasses({ variante: professor === "revogar" ? "perigo" : "secundario", tamanho: "lg" })}>{acao.ocupado ? "Registrando…" : professor === "revogar" ? "Revogar designação" : "Registrar designação"}</button>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
