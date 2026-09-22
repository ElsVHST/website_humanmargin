import type { Metadata } from "next";
import Link from "next/link";
import { leesSite } from "@/lib/content";
import { kopStijl } from "@/lib/tekst";
import { Kop } from "@/components/Kop";
import { Voet } from "@/components/Voet";
import { Beeld } from "@/components/Beeld";

export const metadata: Metadata = { title: { absolute: "Pagina niet gevonden | Human Margin" }, robots: { index: false } };

/** 404: de foto met de hand voor de ogen, één droge zin, terug naar de home (§6.1). */
export default function NietGevonden() {
  const { nietGevonden } = leesSite();
  return (
    <>
      <Kop huidig="" />
      <main id="inhoud" tabIndex={-1}>
        <section className="sectie opening op-donker nietgevonden" data-achtergrond="zwart" aria-labelledby="nietgevonden-kop">
          <div className="wrap">
            <div className="opening__raster">
              <div className="opening__tekst">
                <div className="opening__koppen">
                  <h1 id="nietgevonden-kop" className="kop-1" style={kopStijl(nietGevonden.kop)}>
                    {nietGevonden.kop}
                  </h1>
                </div>
                {/* Eerst de zin, dan pas de knop — zoals op elke andere pagina, en zoals een
                    schermlezer het voorleest. */}
                <div className="opening__lead lead">
                  <p>{nietGevonden.tekst}</p>
                </div>
                <div className="knoppen opening__knoppen">
                  <Link href="/" className="knop">
                    {nietGevonden.knop}
                  </Link>
                </div>
              </div>
              <div className="opening__foto">
                <Beeld id={nietGevonden.beeld} sizes="(min-width: 52rem) 42vw, 100vw" prioriteit focus="30% 40%" />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Voet />
    </>
  );
}
