// Strict allow-list for rich text documents produced by the editor (TipTap/ProseMirror JSON).
// Content is stored as JSON and rendered with React elements, never as raw HTML.

export interface RichMark {
  type: 'bold' | 'italic' | 'link';
  attrs?: { href: string };
}

export interface RichNode {
  type: string;
  attrs?: { level?: number };
  content?: RichNode[];
  text?: string;
  marks?: RichMark[];
}

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'hardBreak', 'text']);
const MAX_DEPTH = 8;
const MAX_NODES = 5000;

export class RichTextError extends Error {}

export function isSafeUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Validates and normalises an editor document. Unknown nodes/marks are rejected. */
export function sanitizeRichDoc(input: unknown): RichNode {
  let count = 0;
  const walk = (node: unknown, depth: number): RichNode => {
    if (++count > MAX_NODES) throw new RichTextError('Document too large');
    if (depth > MAX_DEPTH) throw new RichTextError('Document nested too deeply');
    if (!node || typeof node !== 'object') throw new RichTextError('Invalid node');
    const n = node as Record<string, unknown>;
    const type = n.type;
    if (typeof type !== 'string') throw new RichTextError('Invalid node type');
    if (depth === 0) {
      if (type !== 'doc') throw new RichTextError('Root must be doc');
    } else if (!BLOCK_TYPES.has(type)) {
      throw new RichTextError(`Node type not allowed: ${type}`);
    }
    const out: RichNode = { type };
    if (type === 'heading') {
      const level = (n.attrs as { level?: unknown } | undefined)?.level;
      out.attrs = { level: level === 3 ? 3 : 2 };
    }
    if (type === 'text') {
      if (typeof n.text !== 'string' || n.text.length === 0) throw new RichTextError('Invalid text');
      out.text = n.text.slice(0, 20000);
      if (Array.isArray(n.marks) && n.marks.length) {
        const marks: RichMark[] = [];
        for (const m of n.marks as Array<Record<string, unknown>>) {
          if (m?.type === 'bold' || m?.type === 'italic') marks.push({ type: m.type });
          else if (m?.type === 'link') {
            const href = (m.attrs as { href?: unknown } | undefined)?.href;
            if (isSafeUrl(href)) marks.push({ type: 'link', attrs: { href } });
          }
          // other marks are silently dropped
        }
        if (marks.length) out.marks = marks;
      }
      return out;
    }
    if (Array.isArray(n.content)) {
      out.content = n.content.map((c) => walk(c, depth + 1));
    }
    return out;
  };
  return walk(input, 0);
}

export function plainText(doc: RichNode | null | undefined, max = 100000): string {
  if (!doc) return '';
  const parts: string[] = [];
  const walk = (n: RichNode) => {
    if (n.type === 'text' && n.text) parts.push(n.text);
    if (n.type === 'hardBreak') parts.push('\n');
    n.content?.forEach(walk);
    if (['paragraph', 'heading', 'blockquote', 'listItem'].includes(n.type)) parts.push('\n');
  };
  walk(doc);
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

export function emptyDoc(): RichNode {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

export function textToDoc(text: string): RichNode {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return {
    type: 'doc',
    content: paragraphs.length
      ? paragraphs.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] }))
      : [{ type: 'paragraph' }],
  };
}
