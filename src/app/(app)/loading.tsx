// Esqueleto genérico do shell da equipe: troca de rota deixa de congelar a tela anterior
// (ver docs/42-auditoria-frontend-ux.md, ganho rápido 2). Rotas com loading.tsx próprio
// (ex.: financeiro/continuidade) continuam usando o deles — este só cobre quem não tem.
export default function LoadingApp() {
  return (
    <div className="space-y-4" aria-busy="true">
      <p className="sr-only" role="status">
        Carregando
      </p>
      <div className="h-7 w-48 rounded-md bg-surface-muted" />
      <div className="h-24 rounded-lg bg-surface-muted" />
      <div className="h-24 rounded-lg bg-surface-muted" />
      <div className="h-24 rounded-lg bg-surface-muted" />
    </div>
  );
}
