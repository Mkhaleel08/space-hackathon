import Link from "next/link";
import RoleCard from "@/components/role-card";

export const metadata = { title: "Part history | Machine Memory" };

export default async function ComponentPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <Link href="/scan" className="flex min-h-11 w-fit items-center rounded underline underline-offset-4 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4">
        ← Scan another part
      </Link>
      <RoleCard id={id} />
    </main>
  );
}
