"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { designarAvaliador } from "@/server/avaliacoes/designacao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
import { MensagemStatus } from "@/components/MensagemStatus";

type Professor = { id: string; nome: string };
const normal = (t: string) => t.trim().toLocaleLowerCase("pt-BR");

/**
 * A lista que a tela mostra para o termo digitado. Sem `refinarBusca` o servidor mandou todos os professores
 * que contêm `buscaServidor`; um termo que contém o do servidor só estreita essa lista e é filtrado aqui, sem
 * ir ao servidor. Fora disso (lista cortada em 50, ou termo que não refina) vale a lista do servidor até o
 * "Buscar" trazer a nova.
 */
export function professoresDaBusca(professores: Professor[], buscaServidor: string, refinarBusca: boolean, termo: string): { lista: Professor[]; local: boolean } {
  const local = !refinarBusca && normal(termo).includes(normal(buscaServidor));
  return { local, lista: local ? professores.filter(p => normal(p.nome).includes(normal(termo))) : professores };
}

export function FormularioDesignacao({ alocacaoId, codigoAvaliacao, versaoEsperada, atualId, professores, busca = "", refinarBusca = false }: {
  alocacaoId: string; codigoAvaliacao: string; versaoEsperada: number; atualId: string | null; professores: Professor[];
  /** Termo com que o servidor montou `professores` (vem da URL). */
  busca?: string;
  /** O servidor cortou a lista em 50: refinar exige nova busca no servidor. */
  refinarBusca?: boolean;
}) {
  const router = useRouter(), chave = useRef<string | null>(null);
  const [professor, setProfessor] = useState(""), [motivo, setMotivo] = useState("");
  // O professor escolhido continua na lista mesmo quando outra busca não o traz.
  const [escolhido, setEscolhido] = useState<Professor | null>(null);
  // A busca é estado do formulário (docs/42 L1327): o motivo digitado sobrevive a qualquer busca.
  const [termo, setTermo] = useState(busca);
  // Chave de idempotência estável entre tentativas: na falha de transporte, reenviar sem alterar (MSG_RESULTADO_INCERTO).
  const acao = useAcaoCliente({ idempotente: true });
  const { lista, local } = professoresDaBusca(professores, busca, refinarBusca, termo);
  const opcoes = lista.filter(p => p.id !== atualId);
  const manter = escolhido && escolhido.id === professor && !opcoes.some(p => p.id === escolhido.id) ? escolhido : null;
  // Busca no servidor sem sair da tela: só a lista muda; o formulário não tem key e continua montado.
  const buscar = () => router.replace(`?busca=${encodeURIComponent(termo.trim())}`, { scroll: false });
  return <form className="space-y-3 rounded border p-4" onSubmit={async e => {
    e.preventDefault(); if (!professor) return;
    const chaveIdempotencia = (chave.current ??= crypto.randomUUID());
    const d = await acao.executar(() => designarAvaliador({ alocacaoId, codigoAvaliacao, versaoEsperada, professorId: professor === "revogar" ? null : professor, motivo, chaveIdempotencia }), "Designação registrada.");
    // Registrada: a próxima designação é outra tentativa (chave nova); a tela recebe a versão nova sem remontar.
    if (d?.tipo === "ok") { chave.current = null; router.refresh(); }
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
      <label className="block">Professor ou revogação<select required className="block rounded border p-2" value={professor} onChange={e => {
        const id = e.target.value;
        setProfessor(id); chave.current = null;
        setEscolhido(professores.find(p => p.id === id) ?? (escolhido?.id === id ? escolhido : null));
      }}>
        <option value="" disabled>Selecione uma opção</option>
        {atualId && <option value="revogar">Revogar a designação atual</option>}
        {manter && <option value={manter.id}>{manter.nome}</option>}
        {opcoes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select></label>
      <label className="block">Motivo<CampoTexto required minLength={5} maxLength={2000} value={motivo} className="block w-full rounded border p-2" onChange={e => { setMotivo(e.target.value); chave.current = null; }} /></label>
      <button disabled={!professor} className={botaoClasses({ variante: professor === "revogar" ? "perigo" : "secundario", tamanho: "lg" })}>{acao.ocupado ? "Registrando…" : professor === "revogar" ? "Revogar designação" : "Registrar designação"}</button>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
