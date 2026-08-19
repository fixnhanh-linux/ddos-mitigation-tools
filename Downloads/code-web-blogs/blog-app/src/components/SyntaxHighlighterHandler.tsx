"use client";

import { useEffect } from "react";
import hljs from "highlight.js";
// Import theme
import "highlight.js/styles/atom-one-dark.css";

// Helper function to parse '1,3,5-7' format
function parseLines(str: string): number[] {
  const lines = new Set<number>();
  const parts = str.split(',');
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end; i++) lines.add(i);
    } else {
      lines.add(Number(part));
    }
  }
  return Array.from(lines);
}

export default function SyntaxHighlighterHandler() {
  useEffect(() => {
    // Tìm tất cả các block code và highlight
    const blocks = document.querySelectorAll("pre code");
    blocks.forEach((block) => {
      // Chỉ highlight nếu chưa được highlight
      if (!block.classList.contains("hljs")) {
        hljs.highlightElement(block as HTMLElement);
        
        // Custom line highlight
        const pre = block.parentElement;
        if (pre && pre.dataset.highlightLines) {
          const linesToHighlight = parseLines(pre.dataset.highlightLines);
          const lines = block.innerHTML.split('\n');
          // Xử lý dòng trắng thừa ở cuối nếu có
          if (lines[lines.length - 1] === '') {
            lines.pop();
          }
          const html = lines.map((line, idx) => {
             const lineNum = idx + 1;
             if (linesToHighlight.includes(lineNum)) {
                return `<span style="display: block; background-color: rgba(255, 255, 255, 0.1); border-left: 3px solid #3b82f6; padding-left: 0.5rem; margin-left: -0.5rem;">${line || ' '}</span>`;
             }
             return line;
          }).join('\n');
          block.innerHTML = html;
        }
      }
    });
    
    // Tùy chỉnh CSS của prose để không đụng độ với highlight.js
    const preTags = document.querySelectorAll("pre");
    preTags.forEach(pre => {
      pre.style.backgroundColor = "#282c34"; // Màu nền của atom-one-dark
      pre.style.padding = "1.5rem";
      pre.style.borderRadius = "0.75rem";
      pre.style.margin = "1.5rem 0";
    });
  }, []);

  return null;
}
