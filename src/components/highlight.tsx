import { splitMatches } from "@/lib/search";

export function Highlight({ text, terms }: { text: string; terms?: string[] }) {
  if (!terms?.length) return <>{text}</>;
  return (
    <>
      {splitMatches(text, terms).map((p, i) =>
        p.match ? (
          <mark key={i} className="rounded-sm bg-amber-200 px-0.5 text-inherit dark:bg-amber-800">
            {p.text}
          </mark>
        ) : (
          p.text
        ),
      )}
    </>
  );
}
