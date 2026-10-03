import { redirect } from "next/navigation";

export default async function LegacyComponentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/components/${encodeURIComponent(id)}`);
}
