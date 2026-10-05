import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/** Rendu minimal et sûr (aucun HTML injecté) des réponses : paragraphes, listes, **gras**, [liens](url). */
export function Markdown({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={list.ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it, onNavigate)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const ul = line.match(/^\s*[-•*]\s+(.*)$/);
    if (ol || ul) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((ol ?? ul)![1]);
      continue;
    }
    flush();
    if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line.replace(/^#+\s*/, ""), onNavigate)}</p>);
  }
  flush();
  return <div className="space-y-2.5">{blocks}</div>;
}

function inline(text: string, onNavigate?: () => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={out.length}>{text.slice(last, m.index)}</Fragment>);
    if (m[1]) out.push(<strong key={out.length} className="font-semibold text-white">{m[1]}</strong>);
    else {
      const href = m[3];
      if (href.startsWith("/")) out.push(<Link key={out.length} href={href} onClick={onNavigate} className="font-semibold text-cyan underline underline-offset-2">{m[2]}</Link>);
      else if (/^https?:\/\//.test(href) || href.startsWith("mailto:")) out.push(<a key={out.length} href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-cyan underline underline-offset-2">{m[2]}</a>);
      else out.push(<Fragment key={out.length}>{m[2]}</Fragment>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(<Fragment key={out.length}>{text.slice(last)}</Fragment>);
  return out;
}
