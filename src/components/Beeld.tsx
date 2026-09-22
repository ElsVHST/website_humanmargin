import Image from "next/image";
import { beeld as vindBeeld } from "@/lib/content";

type Props = {
  id: string;
  sizes: string;
  /** Alleen voor het grootste beeld bovenaan de pagina (Priority Hints, AC-T6). */
  prioriteit?: boolean;
  focus?: string;
  className?: string;
  /** Vult de ouder (die een vaste maat of verhouding heeft). */
  vullen?: boolean;
  decoratief?: boolean;
};

export function Beeld({ id, sizes, prioriteit = false, focus = "50% 50%", className, vullen = true, decoratief = false }: Props) {
  const b = vindBeeld(id);
  const alt = decoratief ? "" : b.alt;
  if (vullen) {
    return (
      <div className={["foto", className].filter(Boolean).join(" ")}>
        {/* `priority` zet de preload; `fetchPriority` zet het attribuut op de <img> zelf (AC-T6). */}
        <Image
          src={b.bestand}
          alt={alt}
          fill
          sizes={sizes}
          priority={prioriteit}
          fetchPriority={prioriteit ? "high" : undefined}
          style={{ objectPosition: focus }}
        />
      </div>
    );
  }
  return (
    <Image
      src={b.bestand}
      alt={alt}
      width={b.breedte}
      height={b.hoogte}
      sizes={sizes}
      priority={prioriteit}
      fetchPriority={prioriteit ? "high" : undefined}
      className={className}
    />
  );
}
