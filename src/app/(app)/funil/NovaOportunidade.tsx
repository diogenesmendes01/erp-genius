"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EtapaLead, OrigemCanal } from "@prisma/client";
import { Modal } from "@/components/Modal";
import { Campo } from "@/components/Campo";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { ORIGEM_CANAL_LABEL } from "@/lib/labels";
import { criarLead, moverEtapa } from "@/server/comercial/acoes";
import { buscarPossiveisDuplicados } from "@/server/crm/oportunidades";
import type { PossivelDuplicado } from "@/server/crm/pessoas";

// Etapas de entrada: EXPERIMENTAL_AGENDADA não é oferecida (agende depois de criar). A oportunidade
// nasce em NOVO; as etapas seguintes são alcançadas passo a passo pela máquina de estados (moverEtapa).
type EtapaEntrada = "NOVO" | "EM_ATENDIMENTO" | "QUALIFICADO";
const ETAPAS: { valor: EtapaEntrada; rotulo: string }[] = [
  { valor: "NOVO", rotulo: "Novo" },
  { valor: "EM_ATENDIMENTO", rotulo: "1º contato" },
  { valor: "QUALIFICADO", rotulo: "Qualificado" },
];
const CAMINHO: Record<EtapaEntrada, EtapaLead[]> = {
  NOVO: [],
  EM_ATENDIMENTO: [EtapaLead.EM_ATENDIMENTO],
  QUALIFICADO: [EtapaLead.EM_ATENDIMENTO, EtapaLead.QUALIFICADO],
};

const ESPERA_BUSCA_MS = 400;
const MIN_LETRAS = 3;
const MIN_DIGITOS = 8;
const CONTROLE = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm max-sm:min-h-11";

/** A busca de duplicados só roda com 3 letras do nome ou 8 dígitos do telefone. */
export function buscaLiberada(nome: string, telefone: string): boolean {
  return nome.trim().length >= MIN_LETRAS || telefone.replace(/\D/g, "").length >= MIN_DIGITOS;
}

export function NovaOportunidade({ etapaInicial = "NOVO", podeAtribuir, vendedores, paises, preenchido, aoFechar }: {
  etapaInicial?: EtapaEntrada;
  podeAtribuir: boolean;
  vendedores: { id: string; nome: string }[];
  paises: { id: string; nome: string }[];
  /** Pré-preenchimento por id do cadastro: nome e telefone nunca vão para a URL (contatos.md §8 item 25). */
  preenchido?: { pessoaId?: string; nome?: string };
  aoFechar?: () => void;
}) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: false });
  const [empresa, setEmpresa] = useState(false);
  const [nome, setNome] = useState(preenchido?.nome ?? "");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [paisId, setPaisId] = useState("");
  const [origem, setOrigem] = useState<OrigemCanal | "">("");
  const [etapa, setEtapa] = useState<EtapaEntrada>(etapaInicial);
  const [donoId, setDonoId] = useState("");
  const [pessoaId, setPessoaId] = useState(preenchido?.pessoaId ?? "");
  const [duplicados, setDuplicados] = useState<PossivelDuplicado[]>([]);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [criadaId, setCriadaId] = useState("");
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busca = useRef(0);

  useEffect(() => () => { if (espera.current) clearTimeout(espera.current); }, []);

  function agendarBusca(n: string, t: string, e: string, p: string) {
    if (espera.current) clearTimeout(espera.current);
    const rodada = ++busca.current;
    if (pessoaId || !buscaLiberada(n, t)) {
      setDuplicados([]);
      return;
    }
    espera.current = setTimeout(async () => {
      try {
        const r = await buscarPossiveisDuplicados({ nome: n, telefone: t, email: e, paisId: p || undefined });
        if (rodada === busca.current) setDuplicados(r.ok ? (r.dado ?? []) : []);
      } catch {
        if (rodada === busca.current) setDuplicados([]);
      }
    }, ESPERA_BUSCA_MS);
  }

  const usado = pessoaId ? duplicados.find((d) => d.pessoaId === pessoaId) : undefined;

  function usarCadastro(d: PossivelDuplicado) {
    if (!d.pessoaId) return;
    setPessoaId(d.pessoaId);
    if (d.nome) setNome(d.nome);
    setDuplicados([]);
  }

  async function criar() {
    if (!nome.trim()) {
      setErroLocal(empresa ? "Informe o nome da empresa" : "Informe o nome");
      return;
    }
    setErroLocal(null);
    let id = criadaId;
    if (!id) {
      const d = await acao.executar(() => criarLead({
        nome: nome.trim(),
        telefoneE164: telefone.trim() || undefined,
        email: email.trim() || undefined,
        paisId: paisId || undefined,
        origemCanal: origem || undefined,
        b2b: empresa,
        vendedorDonoId: podeAtribuir && donoId ? donoId : undefined,
        pessoaId: pessoaId || undefined,
      }));
      if (d?.tipo !== "ok" || !d.dado) return;
      id = d.dado.id;
      setCriadaId(id);
    }
    for (const destino of CAMINHO[etapa]) {
      const d = await acao.executar(() => moverEtapa(id, destino));
      if (d?.tipo !== "ok") {
        router.refresh();
        return; // criada em Novo: o erro da etapa fica na tela e "Criar oportunidade" só repete a movimentação
      }
    }
    router.refresh();
    aoFechar?.();
  }

  const fechar = () => aoFechar?.();

  return (
    <Modal titulo="Nova oportunidade" aoFechar={fechar} bloquearFechamento={acao.ocupado}>
      <div role="group" aria-label="Tipo" className="mb-3 flex gap-2">
        <Botao variante={!empresa ? "primario" : "secundario"} tamanho="sm" aria-pressed={!empresa} disabled={acao.ocupado || !!criadaId} onClick={() => setEmpresa(false)}>Pessoa</Botao>
        <Botao variante={empresa ? "primario" : "secundario"} tamanho="sm" aria-pressed={empresa} disabled={acao.ocupado || !!criadaId} onClick={() => setEmpresa(true)}>Empresa</Botao>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <Campo rotulo={empresa ? "Nome da empresa" : "Nome"} obrigatorio erro={erroLocal}>
          {(c) => (
            <input
              {...c}
              type="text"
              className={CONTROLE}
              value={nome}
              disabled={acao.ocupado || !!criadaId}
              onChange={(e) => { setNome(e.target.value); agendarBusca(e.target.value, telefone, email, paisId); }}
            />
          )}
        </Campo>
        <Campo rotulo="WhatsApp">
          {(c) => (
            <input
              {...c}
              type="tel"
              inputMode="tel"
              className={CONTROLE}
              value={telefone}
              disabled={acao.ocupado || !!criadaId}
              onChange={(e) => { setTelefone(e.target.value); agendarBusca(nome, e.target.value, email, paisId); }}
            />
          )}
        </Campo>
        <Campo rotulo="E-mail">
          {(c) => (
            <input
              {...c}
              type="email"
              className={CONTROLE}
              value={email}
              disabled={acao.ocupado || !!criadaId}
              onChange={(e) => { setEmail(e.target.value); agendarBusca(nome, telefone, e.target.value, paisId); }}
            />
          )}
        </Campo>

        {duplicados.length > 0 && (
          <ul aria-live="polite" className="grid gap-2 rounded-md border border-border-soft bg-surface-muted p-3 text-sm">
            {duplicados.map((d, i) => (
              <li key={d.pessoaId ?? `fora-${i}`} className="flex flex-wrap items-center justify-between gap-2">
                <span>{d.nome ? `Já existe no CRM: ${d.nome}` : "Já existe no CRM um cadastro com este contato"}</span>
                {d.pessoaId && <Botao variante="secundario" tamanho="sm" disabled={acao.ocupado} onClick={() => usarCadastro(d)}>Usar cadastro</Botao>}
              </li>
            ))}
          </ul>
        )}
        {pessoaId && (
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-highlight p-3 text-sm">
            <span>{`Usando o cadastro de ${usado?.nome ?? nome}`}</span>
            {!criadaId && <Botao variante="fantasma" tamanho="sm" disabled={acao.ocupado} onClick={() => setPessoaId("")}>Não usar</Botao>}
          </p>
        )}

        <Campo rotulo="País">
          {(c) => (
            <select {...c} className={CONTROLE} value={paisId} disabled={acao.ocupado || !!criadaId} onChange={(e) => setPaisId(e.target.value)}>
              {[<option key="" value="">Não informado</option>, ...paises.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)]}
            </select>
          )}
        </Campo>
        <Campo rotulo="Origem">
          {(c) => (
            <select {...c} className={CONTROLE} value={origem} disabled={acao.ocupado || !!criadaId} onChange={(e) => setOrigem(e.target.value as OrigemCanal | "")}>
              {[<option key="" value="">Não informada</option>, ...Object.values(OrigemCanal).map((o) => <option key={o} value={o}>{ORIGEM_CANAL_LABEL[o]}</option>)]}
            </select>
          )}
        </Campo>
        <Campo rotulo="Etapa">
          {(c) => (
            <select {...c} className={CONTROLE} value={etapa} disabled={acao.ocupado} onChange={(e) => setEtapa(e.target.value as EtapaEntrada)}>
              {ETAPAS.map((e) => <option key={e.valor} value={e.valor}>{e.rotulo}</option>)}
            </select>
          )}
        </Campo>
        {podeAtribuir && (
          <Campo rotulo="Responsável">
            {(c) => (
              <select {...c} className={CONTROLE} value={donoId} disabled={acao.ocupado || !!criadaId} onChange={(e) => setDonoId(e.target.value)}>
                {[<option key="" value="">Sem responsável</option>, ...vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)]}
              </select>
            )}
          </Campo>
        )}
      </div>
      <FeedbackAcao erro={acao.erro} className="mt-3" />
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Botao variante="secundario" disabled={acao.ocupado} onClick={fechar}>Cancelar</Botao>
        <Botao disabled={acao.ocupado} aria-busy={acao.ocupado || undefined} onClick={criar}>
          {acao.ocupado ? "Salvando…" : "Criar oportunidade"}
        </Botao>
      </div>
    </Modal>
  );
}
