// Esqueleto do portal — mesmo efeito do (app)/loading.tsx, aplicado ao lado sem Sidebar
// (ver docs/42-auditoria-frontend-ux.md, ganho rápido 2).
export default function LoadingPortalAluno() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6 sm:p-10" aria-busy="true">
      <p className="sr-only" role="status">
        Carregando
      </p>
      <div className="h-7 w-48 rounded-md bg-gray-100" />
      <div className="h-24 rounded-lg bg-gray-100" />
      <div className="h-24 rounded-lg bg-gray-100" />
    </div>
  );
}
