import { redirect } from "next/navigation";

export default function AbonadosRedirectPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const query = searchParams?.id ? `?id=${searchParams.id}` : "";
  redirect(`/clientes${query}`);
}
