import type { Metadata } from "next";
import { leesPagina } from "@/lib/content";
import { jsonLdVoor, metadataVoor } from "@/lib/seo";
import { PaginaWeergave } from "@/components/PaginaWeergave";
import { JsonLd } from "@/components/JsonLd";

const home = () => {
  const p = leesPagina("home");
  if (!p) throw new Error("content/paginas/home.json ontbreekt");
  return p;
};

export const dynamic = "force-static";

export function generateMetadata(): Metadata {
  return metadataVoor(home());
}

export default function Home() {
  const pagina = home();
  return (
    <>
      <PaginaWeergave pagina={pagina} />
      <JsonLd data={jsonLdVoor(pagina)} />
    </>
  );
}
