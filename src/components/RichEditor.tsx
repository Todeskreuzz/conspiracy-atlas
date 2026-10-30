import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import type { RichNode } from '../../shared/richtext';
import { isSafeUrl } from '../../shared/richtext';
import { useT } from '../i18n';

interface Props {
  value: RichNode;
  onChange: (doc: RichNode) => void;
  labelledBy?: string;
}

/** Locally bundled rich text editor (TipTap/ProseMirror). Output is JSON, validated on the server. */
export function RichEditor({ value, onChange, labelledBy }: Props) {
  const t = useT();
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        horizontalRule: false,
        underline: false,
        link: { openOnClick: false, autolink: true, protocols: ['http', 'https'], HTMLAttributes: { rel: 'noopener noreferrer nofollow ugc' } },
      }),
    ],
    content: value as unknown as Record<string, unknown>,
    editorProps: { attributes: { 'aria-labelledby': labelledBy ?? '', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as RichNode),
  });

  // Replace content when a draft is restored from outside.
  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    if (current !== JSON.stringify(value)) editor.commands.setContent(value as unknown as Record<string, unknown>, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;
  const btn = (label: string, active: boolean, run: () => void, text: string) => (
    <button type="button" title={label} aria-label={label} aria-pressed={active} onMouseDown={(e) => e.preventDefault()} onClick={run}>
      {text}
    </button>
  );
  const setLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt(t('submit.editorToolbar.linkPrompt'), 'https://');
    if (url && isSafeUrl(url)) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };
  return (
    <div className="editor" data-testid="rich-editor">
      <div className="editor__toolbar" role="toolbar">
        {btn(t('submit.editorToolbar.bold'), editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'B')}
        {btn(t('submit.editorToolbar.italic'), editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'I')}
        {btn(t('submit.editorToolbar.h2'), editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'H2')}
        {btn(t('submit.editorToolbar.h3'), editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'H3')}
        {btn(t('submit.editorToolbar.quote'), editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), '❝')}
        {btn(t('submit.editorToolbar.bullet'), editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), '•')}
        {btn(t('submit.editorToolbar.ordered'), editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), '1.')}
        {btn(editor.isActive('link') ? t('submit.editorToolbar.unlink') : t('submit.editorToolbar.link'), editor.isActive('link'), setLink, '🔗')}
      </div>
      <EditorContent editor={editor} className="editor__content" />
    </div>
  );
}
