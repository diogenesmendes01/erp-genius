"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { mesclarContatosDaLista, previaMesclaDaLista } from "@/server/crm/contatos-acoes";
import type { PreviaMescla } from "@/server/crm/duplicados";
import type { ParDuplicado, PessoaMesclavel } from "@/server/crm/ficha-dados";

const CONTROLE = "w-full rounded-md border border-border-soft bg-surface-raised px-2 py-1.5 text-sm max-sm:min-h-11";
const CAMPOS = [
  { chave: "nome", rotulo: "Nome" },
  { chave: "email", rotulo: "E-mail" },
  { chave: "cidade", rotulo: "Cidade" },
  { chave: "cargo", rotulo: "Cargo" },
] as const;

const MOTIVO: Record<string, string> = { telefone: "mesmo telefone", email: "mesmo e-mail", nome: "mesmo nome" };

type Lado = "a" | "b";

/** Resolve as escolhas relativas à pessoa principal: "principal" mantém o dado dela, "secundaria" o da outra. */
export function escolhasDaMescla(
  principal: Lado,
  escolhido: Record<(typeof CAMPOS)[number]["chave"], Lado>,
): Record<(typeof CAMPOS)[number]["chave"], "principal" | "secundaria"> {
  return Object.fromEntries(CAMPOS.map(({ chave }) => [chave, escolhido[chave] === principal ? "principal" : "secundaria"])) as never;
}

const ROTULO_CAMPO: Record<string, string> = Object.fromEntries(CAMPOS.map(({ chave, rotulo }) => [chave, rotulo]));
const contar = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Juntar rótulos em português: "Nome", "Nome e E-mail", "Nome, E-mail e Cidade". */
function juntar(itens: string[]): string {
  return itens.length <= 1 ? (itens[0] ?? "") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** O que a mesclagem muda, a partir da prévia do servidor (D14). */
function ResumoPrevia({ previa }: { previa: PreviaMescla }) {
  const { principal, secundaria, movidos, camposDaSecundaria, cadastroAcademico } = previa;
  const vinculos = [
    movidos.contatos > 0 && contar(movidos.contatos, "telefone", "telefones"),
    movidos.oportunidades > 0 && contar(movidos.oportunidades, "oportunidade", "oportunidades"),
    movidos.participantes > 0 && contar(movidos.participantes, "participação em oportunidade", "participações em oportunidades"),
    movidos.tags > 0 && contar(movidos.tags, "tag", "tags"),
    movidos.valoresCampo > 0 && contar(movidos.valoresCampo, "campo personalizado", "campos personalizados"),
  ].filter((v): v is string => !!v);
  const cadastros = cadastroAcademico
    ? [cadastroAcademico.aluno && "cadastro de aluno", cadastroAcademico.responsavel && "cadastro de responsável"].filter((v): v is string => !!v)
    : [];
  return (
    <>
      <p>{secundaria.nome} é arquivado e tudo dele passa para {principal.nome}.</p>
      <ul className="list-disc pl-5">
        <li>{vinculos.length ? `Passam para ${principal.nome}: ${juntar(vinculos)}.` : `Nenhum telefone, oportunidade, tag ou campo de ${secundaria.nome} para passar.`}</li>
        {camposDaSecundaria.length > 0 && <li>{juntar(camposDaSecundaria.map((c) => ROTULO_CAMPO[c] ?? c))} passam a ser os de {secundaria.nome}.</li>}
        {cadastros.length > 0 && (
          <li>
            O {juntar(cadastros)} de {secundaria.nome} passa a apontar para {principal.nome}. Isso exige a alçada da Secretaria e fica registrado no cadastro.
          </li>
        )}
      </ul>
      <p>Não há desfazer pela tela.</p>
    </>
  );
}

/** Painel da mesclagem de um par. "Revisar" pede a prévia ao servidor; só o "Confirmar" do diálogo mescla. */
export function PainelMescla({ a, b, aoFechar, aoMesclar }: { a: PessoaMesclavel; b: PessoaMesclavel; aoFechar: () => void; aoMesclar: () => void }) {
  const router = useRouter();
  const [principal, setPrincipal] = useState<Lado>("a");
  const [escolhido, setEscolhido] = useState<Record<(typeof CAMPOS)[number]["chave"], Lado>>({ nome: "a", email: "a", cidade: "a", cargo: "a" });
  const [previa, setPrevia] = useState<PreviaMescla | null>(null);
  // A prévia só lê: repetir é seguro, então o resultado incerto pede para tentar de novo.
  const revisao = useAcaoCliente({ idempotente: true });
  const pessoa = { a, b };
  const outra: Lado = principal === "a" ? "b" : "a";
  const entrada = () => ({ principalId: pessoa[principal].id, secundariaId: pessoa[outra].id, escolhas: escolhasDaMescla(principal, escolhido) });

  async function revisar() {
    setPrevia(null);
    const desfecho = await revisao.executar(() => previaMesclaDaLista(entrada()));
    if (desfecho?.tipo !== "ok" || !desfecho.dado) return;
    // A mesclagem seria recusada (ex.: falta a alçada da Secretaria): o motivo aparece e o diálogo não abre.
    if (desfecho.dado.bloqueio) revisao.setErro(desfecho.dado.bloqueio);
    else setPrevia(desfecho.dado);
  }

  return (
    <section role="region" aria-label={`Mesclar ${a.nome} e ${b.nome}`} className="space-y-3 rounded-lg border border-border-soft bg-surface-raised p-3">
      <h3 className="text-sm font-medium">Mesclar {a.nome} e {b.nome}</h3>
      <Campo rotulo="Contato que permanece">
        {(campo) => (
          <select {...campo} className={CONTROLE} value={principal} onChange={(e) => setPrincipal(e.target.value as Lado)}>
            <option value="a">{a.nome}</option>
            <option value="b">{b.nome}</option>
          </select>
        )}
      </Campo>
      {CAMPOS.filter(({ chave }) => pessoa.a[chave] !== pessoa.b[chave]).map(({ chave, rotulo }) => (
        <Campo key={chave} rotulo={`${rotulo} que fica`}>
          {(campo) => (
            <select {...campo} className={CONTROLE} value={escolhido[chave]} onChange={(e) => setEscolhido((atual) => ({ ...atual, [chave]: e.target.value as Lado }))}>
              <option value="a">{pessoa.a[chave] ?? "Vazio"} (de {a.nome})</option>
              <option value="b">{pessoa.b[chave] ?? "Vazio"} (de {b.nome})</option>
            </select>
          )}
        </Campo>
      ))}
      <p className="text-sm text-gray-600">
        Telefones, oportunidades e histórico de {pessoa[outra].nome} passam para {pessoa[principal].nome}. O cadastro de {pessoa[outra].nome} fica arquivado e a mesclagem não é desfeita pela tela.
      </p>
      <FeedbackAcao erro={revisao.erro} sucesso={null} />
      <div className="flex flex-wrap gap-2">
        <Botao tamanho="lg" ocupado={revisao.ocupado} onClick={revisar}>Revisar mesclagem</Botao>
        <Botao variante="fantasma" tamanho="lg" onClick={aoFechar}>Cancelar</Botao>
      </div>
      {previa && (
        <ConfirmarAcao
          titulo={`Mesclar ${previa.secundaria.nome} em ${previa.principal.nome}?`}
          confirmacao="mesclagem"
          idempotente={false}
          acao={() => mesclarContatosDaLista({ principalId: previa.principal.id, secundariaId: previa.secundaria.id, escolhas: escolhasDaMescla(principal, escolhido) })}
          aoConcluir={() => {
            setPrevia(null);
            router.refresh();
            aoMesclar();
          }}
          aoCancelar={() => setPrevia(null)}
        >
          <ResumoPrevia previa={previa} />
        </ConfirmarAcao>
      )}
    </section>
  );
}

/** Duplicados sugeridos e, com duas pessoas marcadas na lista, a mesclagem delas. Só aparece para quem pode mesclar. */
export function MesclarContatos({ pares, selecionado }: { pares: ParDuplicado[]; selecionado: { a: PessoaMesclavel; b: PessoaMesclavel } | null }) {
  const [ativo, setAtivo] = useState<{ a: PessoaMesclavel; b: PessoaMesclavel } | null>(null);
  const acao = useAcaoCliente({ idempotente: false });
  if (pares.length === 0 && !selecionado && !ativo && !acao.sucesso) return null;
  return (
    <section aria-label="Duplicados" className="space-y-2">
      <FeedbackAcao erro={null} sucesso={acao.sucesso} />
      {selecionado && !ativo && (
        <Botao variante="secundario" tamanho="lg" onClick={() => setAtivo(selecionado)}>Mesclar selecionados</Botao>
      )}
      {pares.length > 0 && !ativo && (
        <>
          <h2 className="text-sm font-medium">Possíveis duplicados</h2>
          <ul className="space-y-1">
            {pares.map((p) => (
              <li key={`${p.a.id}:${p.b.id}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{p.a.nome} e {p.b.nome} <span className="text-gray-600">({p.motivos.map((m) => MOTIVO[m] ?? m).join(", ")})</span></span>
                <Botao variante="secundario" tamanho="md" aria-label={`Mesclar ${p.a.nome} e ${p.b.nome}`} onClick={() => setAtivo({ a: p.a, b: p.b })}>Mesclar</Botao>
              </li>
            ))}
          </ul>
        </>
      )}
      {ativo && <PainelMescla a={ativo.a} b={ativo.b} aoFechar={() => setAtivo(null)} aoMesclar={() => { setAtivo(null); acao.setSucesso("Contatos mesclados."); }} />}
    </section>
  );
}
