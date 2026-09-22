/** Gestructureerde gegevens voor zoekmachines. `<` wordt ge-escaped zodat content nooit een script kan sluiten. */
export function JsonLd({ data }: { data: object[] }) {
  return (
    <>
      {data.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, "\\u003c") }} />
      ))}
    </>
  );
}
