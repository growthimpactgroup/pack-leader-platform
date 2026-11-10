"use client";

import { Extension, type CommandProps } from "@tiptap/core";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color, FontFamily, FontSize, LineHeight, TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { htmlToText, MARGINS, marginPx, type Margin } from "@/lib/richtext";

// ---------- Paragraph indent ----------
// Lists indent by nesting; plain paragraphs and headings get a left margin.

const INDENT_STEP = 24;
const MAX_INDENT = 8;

type CommandFn = (props: CommandProps) => boolean;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

const Indent = Extension.create({
  name: "indent",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => Math.round((parseInt(el.style.marginLeft) || 0) / INDENT_STEP),
            renderHTML: (attrs) => (attrs.indent ? { style: `margin-left: ${attrs.indent * INDENT_STEP}px` } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    // Everything runs on the command's own transaction (`commands`, `tr`), so
    // nesting a list and indenting paragraphs never dispatch a second, clashing one.
    const shift: (delta: number) => CommandFn =
      (delta) =>
      ({ editor, commands, tr, state, dispatch }) => {
        if (editor.isActive("listItem")) {
          return delta > 0 ? commands.sinkListItem("listItem") : commands.liftListItem("listItem");
        }
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === "paragraph" || node.type.name === "heading") {
            const next = Math.min(MAX_INDENT, Math.max(0, (node.attrs.indent || 0) + delta));
            if (next !== node.attrs.indent) {
              if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
              changed = true;
            }
          }
        });
        return changed;
      };
    return {
      indent: () => shift(1),
      outdent: () => shift(-1),
    };
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      "Shift-Tab": () => this.editor.commands.outdent(),
    };
  },
});

// ---------- Options ----------

const FONTS = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
];

const SIZES = ["12px", "14px", "15px", "16px", "18px", "20px", "24px", "28px", "32px"];
const LINE_HEIGHTS = ["1", "1.15", "1.5", "1.75", "2"];

const TEXT_COLORS = ["#111827", "#475569", "#4F46E5", "#2563EB", "#059669", "#D97706", "#EA580C", "#DC2626", "#7C3AED", "#DB2777"];
const HIGHLIGHTS = ["#FEF08A", "#BBF7D0", "#BFDBFE", "#FBCFE8", "#FED7AA", "#E9D5FF"];

// ---------- Component ----------

type Props = {
  initialHtml: string;
  initialMargin?: Margin;
};

export function RichEditor({ initialHtml, initialMargin = "normal" }: Props) {
  const [html, setHtml] = useState(initialHtml);
  const [margin, setMargin] = useState<Margin>(initialMargin);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      LineHeight,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Indent,
    ],
    content: initialHtml,
    editorProps: {
      attributes: { class: "email-content min-h-[420px] focus:outline-none", "aria-label": "Full issue text" },
    },
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
  });

  return (
    <div className="overflow-hidden rounded-md border border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200">
      {/* Values the form submits. The plain-text copy feeds the word count and fixed-line checks. */}
      <input type="hidden" name="bodyHtml" id="bodyHtml" value={html} />
      <input type="hidden" name="body" id="body" value={htmlToText(html)} />
      <input type="hidden" name="bodyMargin" id="bodyMargin" value={margin} />

      {editor ? <Toolbar editor={editor} margin={margin} onMargin={setMargin} /> : <div className="h-[84px] border-b border-slate-200 bg-slate-50" />}
      <div className="bg-slate-100 p-3">
        <div className="mx-auto max-w-[640px] rounded bg-white py-6 shadow-sm" style={{ paddingLeft: marginPx(margin), paddingRight: marginPx(margin) }}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

function Toolbar({ editor, margin, onMargin }: { editor: Editor; margin: Margin; onMargin: (m: Margin) => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      highlight: e.isActive("highlight"),
      align: (["left", "center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
      block: e.isActive("heading", { level: 1 }) ? "h1" : e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : "p",
      font: (e.getAttributes("textStyle").fontFamily as string) ?? "",
      size: (e.getAttributes("textStyle").fontSize as string) ?? "",
      color: (e.getAttributes("textStyle").color as string) ?? "",
      lineHeight: (e.getAttributes("textStyle").lineHeight as string) ?? "",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  function setBlock(v: string) {
    if (v === "p") chain().setParagraph().run();
    else chain().toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
  }

  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address (leave empty to remove the link)", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "" || url.trim() === "https://") chain().extendMarkRange("link").unsetLink().run();
    else chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
      <Group>
        <IconButton label="Undo" onClick={() => chain().undo().run()} disabled={!s.canUndo}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label="Redo" onClick={() => chain().redo().run()} disabled={!s.canRedo}>
          <Redo2 size={16} />
        </IconButton>
      </Group>

      <Group>
        <Select label="Text style" value={s.block} onChange={setBlock} width="w-28">
          <option value="p">Normal text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </Select>
        <Select label="Font" value={s.font} onChange={(v) => (v ? chain().setFontFamily(v).run() : chain().unsetFontFamily().run())} width="w-32">
          {FONTS.map((f) => (
            <option key={f.label} value={f.value} style={{ fontFamily: f.value || undefined }}>
              {f.label}
            </option>
          ))}
        </Select>
        <Select label="Text size" value={s.size} onChange={(v) => (v ? chain().setFontSize(v).run() : chain().unsetFontSize().run())} width="w-20">
          <option value="">Size</option>
          {SIZES.map((sz) => (
            <option key={sz} value={sz}>
              {parseInt(sz)}
            </option>
          ))}
        </Select>
      </Group>

      <Group>
        <IconButton label="Bold (Ctrl/Cmd+B)" active={s.bold} onClick={() => chain().toggleBold().run()}>
          <Bold size={16} />
        </IconButton>
        <IconButton label="Italic (Ctrl/Cmd+I)" active={s.italic} onClick={() => chain().toggleItalic().run()}>
          <Italic size={16} />
        </IconButton>
        <IconButton label="Underline (Ctrl/Cmd+U)" active={s.underline} onClick={() => chain().toggleUnderline().run()}>
          <Underline size={16} />
        </IconButton>
        <IconButton label="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()}>
          <Strikethrough size={16} />
        </IconButton>
        <ColorPicker
          label="Text color"
          swatch={s.color || "#111827"}
          colors={TEXT_COLORS}
          onPick={(c) => chain().setColor(c).run()}
          onClear={() => chain().unsetColor().run()}
        >
          <span className="text-sm font-bold leading-none">A</span>
        </ColorPicker>
        <ColorPicker
          label="Highlight color"
          swatch={s.highlight ? (editor.getAttributes("highlight").color as string) || "#FEF08A" : "transparent"}
          colors={HIGHLIGHTS}
          onPick={(c) => chain().setHighlight({ color: c }).run()}
          onClear={() => chain().unsetHighlight().run()}
        >
          <Highlighter size={16} />
        </ColorPicker>
      </Group>

      <Group>
        <IconButton label="Align left" active={s.align === "left"} onClick={() => chain().setTextAlign("left").run()}>
          <AlignLeft size={16} />
        </IconButton>
        <IconButton label="Align center" active={s.align === "center"} onClick={() => chain().setTextAlign("center").run()}>
          <AlignCenter size={16} />
        </IconButton>
        <IconButton label="Align right" active={s.align === "right"} onClick={() => chain().setTextAlign("right").run()}>
          <AlignRight size={16} />
        </IconButton>
        <IconButton label="Justify" active={s.align === "justify"} onClick={() => chain().setTextAlign("justify").run()}>
          <AlignJustify size={16} />
        </IconButton>
      </Group>

      <Group>
        <IconButton label="Bulleted list" active={s.bullet} onClick={() => chain().toggleBulletList().run()}>
          <List size={16} />
        </IconButton>
        <IconButton label="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
          <ListOrdered size={16} />
        </IconButton>
        <IconButton label="Decrease indent (Shift+Tab)" onClick={() => chain().outdent().run()}>
          <IndentDecrease size={16} />
        </IconButton>
        <IconButton label="Increase indent (Tab)" onClick={() => chain().indent().run()}>
          <IndentIncrease size={16} />
        </IconButton>
        <Select label="Line spacing" value={s.lineHeight} onChange={(v) => (v ? chain().setLineHeight(v).run() : chain().unsetLineHeight().run())} width="w-24">
          <option value="">Spacing</option>
          {LINE_HEIGHTS.map((lh) => (
            <option key={lh} value={lh}>
              {lh}
            </option>
          ))}
        </Select>
      </Group>

      <Group>
        <IconButton label="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()}>
          <Quote size={16} />
        </IconButton>
        <IconButton label="Divider line" onClick={() => chain().setHorizontalRule().run()}>
          <Minus size={16} />
        </IconButton>
        <IconButton label="Link" active={s.link} onClick={setLink}>
          <Link2 size={16} />
        </IconButton>
        <IconButton label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
          <Eraser size={16} />
        </IconButton>
      </Group>

      <Group last>
        <Select label="Page margins" value={margin} onChange={(v) => onMargin(v as Margin)} width="w-32">
          {MARGINS.map((m) => (
            <option key={m.value} value={m.value}>
              Margins: {m.label}
            </option>
          ))}
        </Select>
      </Group>
    </div>
  );
}

// ---------- Small pieces ----------

function Group({ children, last }: { children: ReactNode; last?: boolean }) {
  return <div className={`flex items-center gap-0.5 ${last ? "" : "border-r border-slate-200 pr-1"}`}>{children}</div>;
}

function IconButton({ label, onClick, active, disabled, children }: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded text-slate-700 hover:bg-slate-200 disabled:opacity-35 ${active ? "bg-indigo-100 text-indigo-700" : ""}`}
    >
      {children}
    </button>
  );
}

function Select({ label, value, onChange, width, children }: { label: string; value: string; onChange: (v: string) => void; width: string; children: ReactNode }) {
  return (
    <select
      title={label}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 rounded border border-slate-300 bg-white px-1.5 text-xs text-slate-700 ${width}`}
    >
      {children}
    </select>
  );
}

function ColorPicker({
  label,
  swatch,
  colors,
  onPick,
  onClear,
  children,
}: {
  label: string;
  swatch: string;
  colors: string[];
  onPick: (c: string) => void;
  onClear: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-9 flex-col items-center justify-center rounded text-slate-700 hover:bg-slate-200"
      >
        {children}
        <span className="mt-0.5 h-1 w-5 rounded-sm border border-slate-300" style={{ background: swatch }} />
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-20 w-48 rounded-md border border-slate-200 bg-white p-2 shadow-lg" onMouseDown={(e) => e.preventDefault()}>
          <div className="grid grid-cols-6 gap-1.5">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`${label} ${c}`}
                onClick={() => {
                  onPick(c);
                  setOpen(false);
                }}
                className="h-6 w-6 rounded border border-slate-200"
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs">
            <label className="flex items-center gap-1 text-slate-600">
              Custom
              <input type="color" className="h-6 w-8 cursor-pointer" onChange={(e) => onPick(e.target.value)} onBlur={() => setOpen(false)} />
            </label>
            <button
              type="button"
              className="text-slate-500 hover:text-slate-900"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
