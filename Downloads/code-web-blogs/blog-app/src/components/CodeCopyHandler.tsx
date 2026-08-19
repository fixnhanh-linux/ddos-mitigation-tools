"use client";

import { useEffect } from "react";
import { Check, Copy } from "lucide-react";
import { createRoot } from "react-dom/client";



// We will use standard DOM manipulation for the button to avoid React Root conflicts inside dangerouslySetInnerHTML.
export default function CodeCopyHandler() {
  useEffect(() => {
    const blocks = document.querySelectorAll("pre");
    
    blocks.forEach((block) => {
      // Avoid adding multiple buttons if it already exists
      if (block.querySelector(".copy-button")) return;
      
      block.style.position = "relative";
      
      const button = document.createElement("button");
      button.className = "copy-button absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg opacity-0 transition-opacity duration-300";
      button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
      button.title = "Copy code";
      
      // Show button on hover
      block.addEventListener("mouseenter", () => button.classList.remove("opacity-0"));
      block.addEventListener("mouseleave", () => button.classList.add("opacity-0"));

      button.addEventListener("click", async () => {
        const code = block.querySelector("code")?.innerText || block.innerText;
        try {
          await navigator.clipboard.writeText(code);
          button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
          setTimeout(() => {
            button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
          }, 2000);
        } catch (err) {
          console.error("Failed to copy code: ", err);
        }
      });
      
      block.appendChild(button);
    });
  }, []);

  return null;
}
