import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const papeis = (session.user.papeis as string[] | undefined) ?? [];

  return (
    <div className="flex min-h-screen">
      <Sidebar papeis={papeis} nome={session.user.name ?? "Usuário"} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
