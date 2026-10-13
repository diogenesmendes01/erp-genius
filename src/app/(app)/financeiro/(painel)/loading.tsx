import { EsqueletoTabela } from "@/components/Esqueleto";

// Aba do financeiro (docs/42 /financeiro #7: "mini-dashs + lista"). Fica dentro de (painel)/layout.tsx,
// que já desenha o h1 "Financeiro", os atalhos e a barra de abas — antes este esqueleto desenhava título
// e abas de novo, e saíam em dobro (C3 da issue #170). Aqui só o conteúdo da aba.
export default function LoadingFinanceiro() {
  return <EsqueletoTabela rotulo="financeiro" indicadores={4} />;
}
