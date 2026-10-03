import SiteHeader from "@/components/site-header";
import s from "@/components/workspace.module.css";
import RoleCard from "@/components/role-card";

export const metadata = { title: "Part history | Machine Memory" };

export default async function ComponentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <SiteHeader />
      <main id="main-content" className={s.detailPage}>
        <RoleCard id={id} />
      </main>
    </>
  );
}
