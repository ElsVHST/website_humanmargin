/**
 * Een vrije poort vragen aan het besturingssysteem. Een vaste poort hergebruiken gaat mis zodra een
 * vorige server nog naloopt: dan meet je stilletjes de vorige bouw.
 */
import { createServer } from "node:net";

export function vrijePoort() {
  return new Promise((klaar, fout) => {
    const s = createServer();
    s.on("error", fout);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => klaar(port));
    });
  });
}
