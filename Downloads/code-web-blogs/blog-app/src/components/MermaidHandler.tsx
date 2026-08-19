"use client";

import { useEffect } from "react";
import mermaid from "mermaid";

export default function MermaidHandler() {
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
    });

    const renderMermaid = async () => {
      // Find all code blocks with language-mermaid
      const blocks = document.querySelectorAll("code.language-mermaid");
      
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i] as HTMLElement;
        const pre = block.parentElement;
        
        if (pre && pre.tagName.toLowerCase() === "pre" && !pre.classList.contains("mermaid-rendered")) {
          try {
            const chartCode = block.textContent || "";
            const id = `mermaid-svg-${Date.now()}-${i}`;
            
            // Create a new div to hold the SVG
            const graphDiv = document.createElement("div");
            graphDiv.className = "flex justify-center my-8";
            
            // Render the mermaid chart
            const { svg } = await mermaid.render(id, chartCode);
            graphDiv.innerHTML = svg;
            
            // Replace the pre element with the new graph div
            pre.parentNode?.replaceChild(graphDiv, pre);
          } catch (error) {
            console.error("Mermaid rendering failed", error);
          }
        }
      }
    };

    // Need a small delay to ensure DOM is fully ready after React renders dangerouslySetInnerHTML
    const timer = setTimeout(() => {
      renderMermaid();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
