"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlock from "@tiptap/extension-code-block";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Youtube } from "@tiptap/extension-youtube";
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, FileCode2,
  Heading1, Heading2, Heading3, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Link as LinkIcon, Image as ImageIcon, Video as VideoIcon,
  Undo, Redo, Sparkles, Loader2,
  Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
  Highlighter, Eraser
} from "lucide-react";
import { useState, useEffect } from 'react';

const CustomCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      highlightLines: {
        default: null,
        parseHTML: element => element.getAttribute('data-highlight-lines'),
        renderHTML: attributes => {
          if (!attributes.highlightLines) return {};
          return { 'data-highlight-lines': attributes.highlightLines };
        },
      },
    };
  },
});

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
}

const MenuBar = ({ editor, isFocused }: { editor: Editor | null, isFocused: boolean }) => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  if (!editor) {
    return null;
  }

  const handleAiAction = async (action: string) => {
    setIsAiLoading(true);
    setAiResult(null);
    try {
      const text = editor.getText();
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, text })
      });
      const data = await res.json();
      if (data.success) {
        setAiResult(data.result);
      }
    } catch (e) {
      alert("Lỗi kết nối AI");
    }
    setIsAiLoading(false);
  };

  const applyAiResult = () => {
    if (aiResult) {
      editor.commands.setContent(aiResult);
      setAiResult(null);
    }
  };

  const addLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Nhập URL đường dẫn:', previousUrl)
    if (url === null) {
      return
    }
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const addImage = () => {
    const url = window.prompt('Nhập URL hình ảnh:')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  const addYoutube = () => {
    const url = window.prompt('Nhập URL video Youtube:')
    if (url) {
      editor.chain().focus().setYoutubeVideo({
        src: url,
        width: 640,
        height: 480,
      }).run()
    }
  }

  return (
    <>
      <div 
        className={`bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 p-2 flex flex-wrap gap-1 items-center transition-all duration-200 ${isFocused ? 'sticky top-0 z-40 shadow-sm' : ''}`}
        onMouseDown={(e) => e.preventDefault()}
      >
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded ${editor.isActive("bold") ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="In đậm (Ctrl+B)"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded ${editor.isActive("italic") ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="In nghiêng (Ctrl+I)"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded ${editor.isActive("underline") ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Gạch chân (Ctrl+U)"
        >
          <UnderlineIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded ${editor.isActive("strike") ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Gạch ngang"
        >
          <Strikethrough size={16} />
        </button>

        <div className="w-px h-5 bg-slate-300 mx-0.5"></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          className={`p-1.5 rounded ${editor.isActive("subscript") ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Chỉ số dưới"
        >
          <SubscriptIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          className={`p-1.5 rounded ${editor.isActive("superscript") ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Chỉ số trên"
        >
          <SuperscriptIcon size={16} />
        </button>

        <div className="w-px h-5 bg-slate-300 mx-0.5"></div>

        <div className="flex items-center gap-1 p-1">
          <input
            type="color"
            onInput={event => editor.chain().focus().setColor((event.target as HTMLInputElement).value).run()}
            value={editor.getAttributes('textStyle').color || '#000000'}
            className="w-5 h-5 border-0 p-0 cursor-pointer bg-transparent rounded"
            title="Màu chữ"
          />
        </div>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
          className={`p-1.5 rounded ${editor.isActive("highlight") ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Tô nền vàng"
        >
          <Highlighter size={16} />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
          title="Xóa định dạng"
        >
          <Eraser size={16} />
        </button>
        
        <div className="w-px h-5 bg-slate-300 mx-0.5"></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded ${editor.isActive("heading", { level: 1 }) ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Tiêu đề 1"
        >
          <Heading1 size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded ${editor.isActive("heading", { level: 2 }) ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Tiêu đề 2"
        >
          <Heading2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded ${editor.isActive("heading", { level: 3 }) ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Tiêu đề 3"
        >
          <Heading3 size={16} />
        </button>
        
        <div className="w-px h-5 bg-slate-300 mx-0.5"></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-1.5 rounded ${editor.isActive({ textAlign: 'left' }) ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Căn trái"
        >
          <AlignLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-1.5 rounded ${editor.isActive({ textAlign: 'center' }) ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Căn giữa"
        >
          <AlignCenter size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-1.5 rounded ${editor.isActive({ textAlign: 'right' }) ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Căn phải"
        >
          <AlignRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={`p-1.5 rounded ${editor.isActive({ textAlign: 'justify' }) ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Căn đều 2 bên"
        >
          <AlignJustify size={16} />
        </button>

        <div className="w-px h-5 bg-slate-300 mx-0.5"></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded ${editor.isActive("bulletList") ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Danh sách gạch đầu dòng"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded ${editor.isActive("orderedList") ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Danh sách số"
        >
          <ListOrdered size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded ${editor.isActive("blockquote") ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Trích dẫn"
        >
          <Quote size={16} />
        </button>

        <div className="w-px h-5 bg-slate-300 mx-0.5"></div>

        <button
          type="button"
          onClick={addLink}
          className={`p-1.5 rounded ${editor.isActive("link") ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Chèn liên kết"
        >
          <LinkIcon size={16} />
        </button>
        <button
          type="button"
          onClick={addImage}
          className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
          title="Chèn ảnh bằng URL"
        >
          <ImageIcon size={16} />
        </button>
        <button
          type="button"
          onClick={addYoutube}
          className={`p-1.5 rounded ${editor.isActive("youtube") ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Chèn video Youtube"
        >
          <VideoIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`p-1.5 rounded ${editor.isActive("code") ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Mã inline"
        >
          <Code size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-1.5 rounded ${editor.isActive("codeBlock") ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          title="Khối mã (Code block)"
        >
          <FileCode2 size={16} />
        </button>

        <div className="w-px h-5 bg-slate-300 mx-0.5"></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition disabled:opacity-30"
          title="Hoàn tác (Ctrl+Z)"
        >
          <Undo size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition disabled:opacity-30"
          title="Làm lại (Ctrl+Y)"
        >
          <Redo size={16} />
        </button>

        <div className="flex-1"></div>
        
        <div className="relative group">
          <button className="flex items-center gap-1 p-1.5 px-2 text-purple-600 hover:bg-purple-50 rounded font-medium text-xs transition border border-purple-200">
            {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>Trợ lý AI</span>
          </button>
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded shadow-xl border border-slate-100 p-2 hidden group-hover:block z-50">
            <button onClick={() => handleAiAction('grammar')} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded">Sửa chính tả & Ngữ pháp</button>
            <button onClick={() => handleAiAction('summarize')} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded">Tóm tắt bài viết</button>
            <button onClick={() => handleAiAction('title_ideas')} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded">Gợi ý 3 Tiêu đề SEO</button>
          </div>
        </div>
      </div>

      {editor.isActive("codeBlock") && (
        <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center gap-4 text-sm z-30 relative animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Ngôn ngữ:</span>
            <input 
              type="text" 
              placeholder="VD: python" 
              className="px-2 py-1 border border-slate-300 rounded text-xs w-32 focus:outline-blue-500"
              value={editor.getAttributes('codeBlock').language || ''}
              onChange={(e) => editor.chain().focus().updateAttributes('codeBlock', { language: e.target.value }).run()}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Bôi sáng dòng:</span>
            <input 
              type="text" 
              placeholder="VD: 1-5,8" 
              className="px-2 py-1 border border-slate-300 rounded text-xs w-32 focus:outline-blue-500"
              value={editor.getAttributes('codeBlock').highlightLines || ''}
              onChange={(e) => editor.chain().focus().updateAttributes('codeBlock', { highlightLines: e.target.value }).run()}
            />
            <span className="text-slate-500 text-xs italic">(Sẽ hiển thị màu khi lưu và xem bài viết)</span>
          </div>
        </div>
      )}

      {aiResult && (
        <div className="m-3 p-4 bg-purple-50 border border-purple-100 rounded-xl relative z-40">
          <div className="flex items-center gap-2 text-purple-800 font-semibold mb-2">
            <Sparkles size={16} /> AI đề xuất:
          </div>
          <div className="text-sm text-slate-700 whitespace-pre-wrap">{aiResult}</div>
          <div className="mt-3 flex gap-2">
            <button onClick={applyAiResult} className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700">Thay thế nội dung hiện tại</button>
            <button onClick={() => setAiResult(null)} className="px-3 py-1.5 bg-white text-slate-600 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50">Đóng</button>
          </div>
        </div>
      )}
    </>
  );
};

export default function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const [isFocused, setIsFocused] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CustomCodeBlock,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      Youtube.configure({
        controls: false,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose-base focus:outline-none min-h-[300px] max-w-none p-4",
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <div className="border border-slate-200 rounded-lg bg-white relative z-0">
      <MenuBar editor={editor} isFocused={isFocused} />
      <EditorContent editor={editor} />
    </div>
  );
}
