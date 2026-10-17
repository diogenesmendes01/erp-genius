"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CorTag } from "@prisma/client";
import { Avatar } from "@/components/Avatar";
import { Botao, botaoClasses } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { CampoTexto } from "@/components/CampoTexto";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { ETAPA_LABEL, ORIGEM_CANAL_LABEL, TEMPERATURA_LABEL } from "@/lib/labels";
import {
  atribuirTagDaFicha,
  definirCampoDaFicha,
  editarPessoaDaFicha,
  registrarNotaDaFicha,
  registrarOptOutDaFicha,
  removerTagDaFicha,
} from "@/server/crm/contatos-acoes";
import type { DetalheContato } from "@/server/crm/contatos";
import type { CampoDaFicha } from "@/server/crm/ficha-dados";
import type { FiltroHistoricoPessoa } from "@/server/crm/historico";
import type { ItemHistorico } from "@/server/crm/historico";
import type { CapacidadeCrm } from "@/server/crm/permissoes";
import { FUSO_PADRAO } from "../funil/CartaoOportunidade";
import { NovaOportunidade } from "../funil/NovaOportunidade";

type Aba = "geral" | "historico" | "oportunidades" | "campos";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "geral", rotulo: "Visão geral" },
  { id: "historico", rotulo: "Histórico" },
  { id: "oportunidades", rotulo: "Oportunidades" },
  { id: "campos", rotulo: "Campos" },
];


const CONTROLE = "w-full rounded-md border border-border-soft bg-surface-raised px-2 py-1.5 text-sm max-sm:min-h-11";

type Props = {
  detalhe: DetalheContato;
  historico: ItemHistorico[];
  campos: CampoDaFicha[];
  tagsDisponiveis: { id: string; nome: string; cor: CorTag }[];
  /** Classes de cor de cada tag (mapa do servidor; o módulo das tags não vai para o cliente). */
  classesCor: Record<CorTag, string>;
  capacidades: CapacidadeCrm[];
  vendedores: { id: string; nome: string }[];
  paises: { id: string; nome: string }[];
  filtroHistorico?: FiltroHistoricoPessoa;
  /** Link "‹ Contatos" (volta à lista com os filtros atuais). */
  hrefVoltar?: string;
  /** Links do filtro do histórico (mantêm a lista e a pessoa abertas). */
  hrefsHistorico?: Record<FiltroHistoricoPessoa, string>;
  fuso?: string;
  abaInicial?: Aba;
};

const dataHora = (d: Date | string, fuso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, dateStyle: "short", timeStyle: "short" }).format(new Date(d));

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-soft py-2 text-sm">
      <dt className="text-gray-600">{rotulo}</dt>
      <dd className="text-right text-gray-900">{children}</dd>
    </div>
  );
}

/** Valor do campo como o controle mostra: texto, ou "true"/"false" para o booleano. */
function valorInicial(c: CampoDaFicha): string {
  if (c.valor === null || c.valor === undefined) return "";
  return String(c.valor);
}

function FichaCorpo({
  detalhe: d,
  historico,
  campos,
  tagsDisponiveis,
  classesCor,
  capacidades,
  vendedores,
  paises,
  filtroHistorico = "tudo",
  hrefVoltar = "/contatos",
  hrefsHistorico,
  fuso = FUSO_PADRAO,
  abaInicial = "geral",
}: Props) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>(abaInicial);
  const acao = useAcaoCliente({ idempotente: false });
  const pode = (c: CapacidadeCrm) => capacidades.includes(c);
  const podeEditar = pode("contatos.editar");
  const classeFiltro = (f: FiltroHistoricoPessoa) => botaoClasses({ variante: filtroHistorico === f ? "primario" : "fantasma", tamanho: "sm" });
  const podeCriarOportunidade = pode("funil.mover");
  const abas = ABAS.filter((a) => a.id !== "oportunidades" || pode("funil.ver"));

  const [nome, setNome] = useState(d.nome);
  const [email, setEmail] = useState(d.email ?? "");
  const [cidade, setCidade] = useState(d.cidade ?? "");
  const [cargo, setCargo] = useState(d.cargo ?? "");
  const [linkedin, setLinkedin] = useState(d.linkedin ?? "");
  const [tagNova, setTagNova] = useState("");
  const [nota, setNota] = useState("");
  const [motivoOptOut, setMotivoOptOut] = useState("");
  const [confirmandoOptOut, setConfirmandoOptOut] = useState(false);
  const [novaOportunidade, setNovaOportunidade] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(campos.map((c) => [c.id, valorInicial(c)])));

  const tagsLivres = tagsDisponiveis.filter((t) => !d.tags.some((x) => x.id === t.id));
  const podeOptOut = podeEditar && d.telefones.length > 0 && !d.optOut;

  async function rodar(f: () => ReturnType<typeof registrarNotaDaFicha>, sucesso: string, depois?: () => void) {
    const r = await acao.executar(f, sucesso);
    if (r?.tipo === "ok") {
      router.refresh();
      depois?.();
    }
  }

  async function salvarDados() {
    await rodar(
      () => editarPessoaDaFicha(d.id, { nome, email: email || null, cidade: cidade || null, cargo: cargo || null, linkedin: linkedin || null }),
      "Dados salvos.",
    );
  }

  async function salvarCampos() {
    acao.limpar();
    const mudados = campos.filter((c) => (valores[c.id] ?? "") !== valorInicial(c));
    if (mudados.length === 0) return acao.setErro("Nenhum campo foi alterado.");
    for (const c of mudados) {
      const r = await acao.executar(() => definirCampoDaFicha({ campoId: c.id, pessoaId: d.id, valor: valores[c.id] ?? "" }));
      if (r?.tipo !== "ok") return;
    }
    acao.setSucesso(mudados.length === 1 ? "Campo salvo." : `${mudados.length} campos salvos.`);
    router.refresh();
  }

  function pedirOptOut() {
    acao.limpar();
    const m = motivoOptOut.trim();
    if (!m) return acao.setErro("Informe o motivo do opt-out.");
    if (m.length > 500) return acao.setErro("O motivo deve ter até 500 caracteres.");
    setConfirmandoOptOut(true);
  }

  return (
    <article className="space-y-4" aria-label={`Ficha de ${d.nome}`}>
      <Link href={hrefVoltar} className="inline-flex min-h-11 items-center text-sm text-brand-700 hover:underline min-[700px]:hidden">
        ‹ Contatos
      </Link>
      <header className="flex items-start gap-3">
        <Avatar nome={d.nome} tamanho={48} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-medium">{d.nome}</h2>
          <p className="text-sm text-gray-600">
            {[d.codigo, d.empresa?.nome, d.ehAluno ? "Aluno" : null].filter(Boolean).join(" · ") || "Contato"}
          </p>
          {d.optOut && <p className="mt-1 text-sm text-red-700">Opt-out registrado: não recebe mensagens.</p>}
        </div>
        {podeCriarOportunidade && (
          <Botao tamanho="md" onClick={() => setNovaOportunidade(true)}>Nova oportunidade</Botao>
        )}
      </header>

      <div role="tablist" aria-label="Seções do contato" className="flex gap-1 overflow-x-auto border-b border-border-soft">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            id={`aba-contato-${a.id}`}
            aria-selected={aba === a.id}
            aria-controls={`painel-contato-${a.id}`}
            onClick={() => setAba(a.id)}
            className={
              "min-h-10 shrink-0 border-b-2 px-3 text-sm max-sm:min-h-11 " +
              (aba === a.id ? "border-brand-600 font-medium text-brand-800" : "border-transparent text-gray-600 hover:bg-highlight")
            }
          >{a.rotulo}</button>
        ))}
      </div>

      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />

      {aba === "geral" && (
        <div role="tabpanel" id="painel-contato-geral" aria-labelledby="aba-contato-geral" className="space-y-5">
          <dl>
            <Linha rotulo="WhatsApp">
              {d.telefones.length === 0 ? (
                <EstadoVazio>Nenhum telefone cadastrado.</EstadoVazio>
              ) : (
                d.telefones.map((t) => (
                  <span key={t.telefone} className="block">{t.telefone}{t.optOut ? " (opt-out)" : ""}</span>
                ))
              )}
            </Linha>
            <Linha rotulo="E-mail">{d.email ?? "Não informado"}</Linha>
            <Linha rotulo="Cidade">{d.cidade ?? "Não informada"}</Linha>
            <Linha rotulo="Cargo">{d.cargo ?? "Não informado"}</Linha>
            <Linha rotulo="Origem">{d.origemCanal ? ORIGEM_CANAL_LABEL[d.origemCanal] : "Não informada"}</Linha>
            <Linha rotulo="Cadastrado em">{dataHora(d.criadoEm, fuso)}</Linha>
          </dl>

          <section aria-label="Tags" className="space-y-2">
            <h3 className="text-sm font-medium">Tags</h3>
            {d.tags.length === 0 ? (
              <EstadoVazio>Nenhuma tag neste contato.</EstadoVazio>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {d.tags.map((t) => (
                  <li key={t.id} className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-xs ${classesCor[t.cor]}`}>
                    {t.nome}
                    {podeEditar && (
                      <Botao
                        variante="fantasma"
                        tamanho="sm"
                        aria-label={`Remover a tag ${t.nome}`}
                        disabled={acao.ocupado}
                        onClick={() => rodar(() => removerTagDaFicha({ tagId: t.id, pessoaId: d.id }), "Tag removida.")}
                      >×</Botao>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {podeEditar && tagsLivres.length > 0 && (
              <div className="flex flex-wrap items-end gap-2">
                <Campo rotulo="Adicionar tag" className="min-w-40 flex-1">
                  {(campo) => (
                    <select {...campo} className={CONTROLE} value={tagNova} onChange={(e) => setTagNova(e.target.value)}>
                      <option value="">Selecione</option>
                      {tagsLivres.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                    </select>
                  )}
                </Campo>
                <Botao
                  variante="secundario"
                  tamanho="lg"
                  disabled={!tagNova || acao.ocupado}
                  onClick={() => rodar(() => atribuirTagDaFicha({ tagId: tagNova, pessoaId: d.id }), "Tag adicionada.", () => setTagNova(""))}
                >Adicionar</Botao>
              </div>
            )}
          </section>

          {podeEditar && (
            <form
              className="space-y-3"
              aria-label="Editar dados"
              onSubmit={(e) => { e.preventDefault(); void salvarDados(); }}
            >
              <h3 className="text-sm font-medium">Editar dados</h3>
              <Campo rotulo="Nome">{(campo) => <input {...campo} className={CONTROLE} value={nome} maxLength={200} onChange={(e) => setNome(e.target.value)} />}</Campo>
              <Campo rotulo="E-mail">{(campo) => <input {...campo} type="email" className={CONTROLE} value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} />}</Campo>
              <Campo rotulo="Cidade">{(campo) => <input {...campo} className={CONTROLE} value={cidade} maxLength={120} onChange={(e) => setCidade(e.target.value)} />}</Campo>
              <Campo rotulo="Cargo">{(campo) => <input {...campo} className={CONTROLE} value={cargo} maxLength={120} onChange={(e) => setCargo(e.target.value)} />}</Campo>
              <Campo rotulo="LinkedIn">{(campo) => <input {...campo} className={CONTROLE} value={linkedin} maxLength={300} onChange={(e) => setLinkedin(e.target.value)} />}</Campo>
              <Botao type="submit" tamanho="lg" disabled={acao.ocupado}>Salvar dados</Botao>
            </form>
          )}

          {podeOptOut && (
            <section aria-label="Opt-out" className="space-y-2 rounded-lg border border-border-soft p-3">
              <h3 className="text-sm font-medium">Opt-out de mensagens</h3>
              <p className="text-sm text-gray-600">O contato deixa de receber mensagens. Esta ação não pode ser revertida pela tela.</p>
              <Campo rotulo="Motivo">
                {(campo) => <input {...campo} className={CONTROLE} value={motivoOptOut} maxLength={500} onChange={(e) => setMotivoOptOut(e.target.value)} />}
              </Campo>
              <Botao variante="perigo" tamanho="lg" onClick={pedirOptOut}>Registrar opt-out</Botao>
            </section>
          )}
        </div>
      )}

      {aba === "historico" && (
        <div role="tabpanel" id="painel-contato-historico" aria-labelledby="aba-contato-historico" className="space-y-4">
          <nav className="flex flex-wrap gap-1" aria-label="Filtro do histórico">
            <Link href={hrefsHistorico?.tudo ?? "/contatos"} aria-current={filtroHistorico === "tudo" ? "page" : undefined} className={classeFiltro("tudo")}>Tudo</Link>
            <Link href={hrefsHistorico?.notas ?? "/contatos"} aria-current={filtroHistorico === "notas" ? "page" : undefined} className={classeFiltro("notas")}>Notas</Link>
            <Link href={hrefsHistorico?.etapas ?? "/contatos"} aria-current={filtroHistorico === "etapas" ? "page" : undefined} className={classeFiltro("etapas")}>Etapas</Link>
            <Link href={hrefsHistorico?.alteracoes ?? "/contatos"} aria-current={filtroHistorico === "alteracoes" ? "page" : undefined} className={classeFiltro("alteracoes")}>Alterações</Link>
          </nav>
          {podeEditar && (
            <form
              className="space-y-2"
              aria-label="Nova nota"
              onSubmit={(e) => {
                e.preventDefault();
                void rodar(() => registrarNotaDaFicha(d.id, nota), "Nota registrada.", () => setNota(""));
              }}
            >
              <Campo rotulo="Nota interna" dica="Só a equipe vê. Nunca é enviada ao contato.">
                {(campo) => <CampoTexto {...campo} className={CONTROLE} rows={3} maxLength={2000} value={nota} onChange={(e) => setNota(e.target.value)} />}
              </Campo>
              <Botao type="submit" tamanho="md" disabled={acao.ocupado || !nota.trim()}>Registrar nota</Botao>
            </form>
          )}
          {historico.length === 0 ? (
            <EstadoVazio>Nenhuma atividade registrada.</EstadoVazio>
          ) : (
            <ol className="space-y-3">
              {[...historico].reverse().map((h) => (
                <li key={h.id} className="border-b border-border-soft pb-2 text-sm">
                  <p className="font-medium">{h.rotulo}</p>
                  {h.texto && <p className="mt-1 whitespace-pre-wrap text-gray-800">{h.texto}</p>}
                  <p className="text-xs text-gray-600">{[h.autor, dataHora(h.em, fuso)].filter(Boolean).join(" · ")}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {aba === "oportunidades" && pode("funil.ver") && (
        <div role="tabpanel" id="painel-contato-oportunidades" aria-labelledby="aba-contato-oportunidades" className="space-y-3">
          {d.oportunidades.length === 0 ? (
            <EstadoVazio>Nenhuma oportunidade deste contato na sua carteira.</EstadoVazio>
          ) : (
            <ul className="space-y-2">
              {d.oportunidades.map((o) => (
                <li key={o.id}>
                  <Link href={`/funil?o=${o.id}`} className="block min-h-11 rounded-item p-3 hover:bg-highlight">
                    <span className="block font-medium">{o.nome}</span>
                    <span className="block text-sm text-gray-600">
                      {ETAPA_LABEL[o.etapa]} · {TEMPERATURA_LABEL[o.temperatura]} · {o.dono ?? "Sem responsável"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {aba === "campos" && (
        <div role="tabpanel" id="painel-contato-campos" aria-labelledby="aba-contato-campos" className="space-y-3">
          {campos.length === 0 ? (
            <EstadoVazio>Nenhum campo personalizado de pessoa foi criado.</EstadoVazio>
          ) : (
            <form
              className="space-y-3"
              aria-label="Campos personalizados"
              onSubmit={(e) => { e.preventDefault(); void salvarCampos(); }}
            >
              {campos.map((c) => {
                const v = valores[c.id] ?? "";
                const atualizar = (novo: string) => setValores((atual) => ({ ...atual, [c.id]: novo }));
                if (c.tipo === "BOOLEANO") {
                  return (
                    <label key={c.id} className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" checked={v === "true"} disabled={!podeEditar} onChange={(e) => atualizar(e.target.checked ? "true" : "false")} className="h-4 w-4" />
                      {c.nome}
                    </label>
                  );
                }
                if (c.tipo === "SELECAO") {
                  return (
                    <Campo key={c.id} rotulo={c.nome} obrigatorio={c.obrigatorio}>
                      {(campo) => (
                        <select {...campo} className={CONTROLE} value={v} disabled={!podeEditar} onChange={(e) => atualizar(e.target.value)}>
                          <option value="">Não informado</option>
                          {c.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                    </Campo>
                  );
                }
                if (c.tipo === "DATA") {
                  return (
                    <Campo key={c.id} rotulo={c.nome} obrigatorio={c.obrigatorio}>
                      {(campo) => <input {...campo} type="date" className={CONTROLE} value={v} disabled={!podeEditar} onChange={(e) => atualizar(e.target.value)} />}
                    </Campo>
                  );
                }
                if (c.tipo === "NUMERO") {
                  return (
                    <Campo key={c.id} rotulo={c.nome} obrigatorio={c.obrigatorio}>
                      {(campo) => <input {...campo} type="text" inputMode="decimal" className={CONTROLE} value={v} disabled={!podeEditar} onChange={(e) => atualizar(e.target.value)} />}
                    </Campo>
                  );
                }
                return (
                  <Campo key={c.id} rotulo={c.nome} obrigatorio={c.obrigatorio}>
                    {(campo) => <input {...campo} type="text" className={CONTROLE} value={v} maxLength={500} disabled={!podeEditar} onChange={(e) => atualizar(e.target.value)} />}
                  </Campo>
                );
              })}
              {podeEditar && <Botao type="submit" tamanho="lg" disabled={acao.ocupado}>Salvar campos</Botao>}
            </form>
          )}
        </div>
      )}

      {confirmandoOptOut && (
        <ConfirmarAcao
          titulo={`Registrar opt-out de ${d.nome}?`}
          confirmacao="opt-out"
          idempotente={false}
          acao={() => registrarOptOutDaFicha(d.id, motivoOptOut.trim())}
          aoConcluir={() => {
            setConfirmandoOptOut(false);
            setMotivoOptOut("");
            acao.setSucesso("Opt-out registrado.");
            router.refresh();
          }}
          aoCancelar={() => setConfirmandoOptOut(false)}
        >
          <p>{d.nome} deixa de receber mensagens em todos os telefones cadastrados.</p>
          <p>Não há como reverter esta ação pela tela.</p>
        </ConfirmarAcao>
      )}

      {novaOportunidade && (
        <NovaOportunidade
          podeAtribuir={pode("funil.atribuir")}
          vendedores={vendedores}
          paises={paises}
          preenchido={{ pessoaId: d.id, nome: d.nome }}
          aoFechar={() => setNovaOportunidade(false)}
        />
      )}
    </article>
  );
}

/** A ficha remonta ao trocar de pessoa: os campos de edição nascem dos dados da pessoa aberta. */
export function FichaContato(props: Props) {
  return <FichaCorpo key={props.detalhe.id} {...props} />;
}
