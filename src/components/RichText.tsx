import type { ReactNode } from 'react';
import type { RichNode } from '../../shared/richtext';
import { isSafeUrl } from '../../shared/richtext';

/** Renders validated editor JSON with React elements. No HTML strings are ever injected. */
export function RichText({ doc }: { doc: RichNode | null | undefined }) {
  if (!doc) return null;
  return <div className="rich-text">{renderChildren(doc.content)}</div>;
}

function renderChildren(nodes: RichNode[] | undefined): ReactNode {
  return nodes?.map((n, i) => renderNode(n, i));
}

function renderNode(n: RichNode, key: number): ReactNode {
  switch (n.type) {
    case 'paragraph':
      return <p key={key}>{renderChildren(n.content)}</p>;
    case 'heading':
      return n.attrs?.level === 3 ? <h4 key={key}>{renderChildren(n.content)}</h4> : <h3 key={key}>{renderChildren(n.content)}</h3>;
    case 'blockquote':
      return <blockquote key={key}>{renderChildren(n.content)}</blockquote>;
    case 'bulletList':
      return <ul key={key}>{renderChildren(n.content)}</ul>;
    case 'orderedList':
      return <ol key={key}>{renderChildren(n.content)}</ol>;
    case 'listItem':
      return <li key={key}>{renderChildren(n.content)}</li>;
    case 'hardBreak':
      return <br key={key} />;
    case 'text': {
      let el: ReactNode = n.text;
      for (const m of n.marks ?? []) {
        if (m.type === 'bold') el = <strong>{el}</strong>;
        else if (m.type === 'italic') el = <em>{el}</em>;
        else if (m.type === 'link' && isSafeUrl(m.attrs?.href)) {
          el = (
            <a href={m.attrs!.href} target="_blank" rel="noopener noreferrer nofollow ugc">
              {el}
            </a>
          );
        }
      }
      return <span key={key}>{el}</span>;
    }
    default:
      return null;
  }
}
