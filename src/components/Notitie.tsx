/* eslint-disable @next/next/no-img-element -- kleine, vaste SVG-pijlen; next/image voegt hier niets toe */
import type { Kantlijn } from "@/lib/schema";

type NotitieData = Kantlijn["notities"][number];

/**
 * Een handgeschreven notitie (V14, "de kantlijn"). Altijd decoratief: ze herhaalt wat ernaast staat
 * of is een uitroep zonder informatie, dus aria-hidden (AC-A3). Zonder JavaScript staat ze gewoon
 * in beeld in het terugvalfont; met JavaScript verschijnt ze pas als het handschriftfont binnen is
 * en haar alinea voor 30 % in beeld is (features/kantlijn).
 */
export function Notitie({ notitie }: { notitie: NotitieData }) {
  return (
    <span className={`notitie notitie--${notitie.kleur}`} aria-hidden="true" data-notitie data-kleur={notitie.kleur}>
      {notitie.pijl && <img className="notitie__pijl" src={`/merk/getekend/${notitie.pijl}.svg`} alt="" width={96} height={48} loading="lazy" decoding="async" />}
      <span className="notitie__tekst">{notitie.tekst}</span>
    </span>
  );
}
