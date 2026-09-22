import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { leesPagina, leesPaginas } from "@/lib/content";
import { jsonLdVoor, metadataVoor } from "@/lib/seo";
import { PaginaWeergave } from "@/components/PaginaWeergave";
import { JsonLd } from "@/components/JsonLd";

/*
 * Eén route voor elke pagina uit content/paginas/*.json (AC-P9). Een nieuw bestand levert bij de
 * volgende bouw een nieuwe statische pagina op; een onbekend adres geeft 404 (dynamicParams = false).
 */
export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return leesPaginas()
    .filter((p) => p.slug !== "home")
    .map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const pagina = leesPagina(slug);
  return pagina ? metadataVoor(pagina) : {};
}

export default async function Pagina({ params }: Props) {
  const { slug } = await params;
  const pagina = leesPagina(slug);
  if (!pagina || slug === "home") notFound();
  return (
    <>
      <PaginaWeergave pagina={pagina} />
      <JsonLd data={jsonLdVoor(pagina)} />
    </>
  );
}
