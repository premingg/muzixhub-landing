// Component ported and enhanced from https://codepen.io/JuanFuentes/pen/eYEeoyE
import { useEffect, useRef, useMemo } from "react";

interface ASCIITextProps {
  text?: string;
  enableWaves?: boolean;
  asciiFontSize?: number;
}

// Simpler, more readable ASCII gradient
const ASCII_CHARS = " .,;+*X#@";

export default function ASCIIText({
  text = "Hello",
  enableWaves = true,
  asciiFontSize = 12,
}: ASCIITextProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const asciiChars = useMemo(() => ASCII_CHARS.split(""), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const render = () => {
      const width = container.offsetWidth;
      const height = container.offsetHeight;

      canvas.width = width;
      canvas.height = height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Larger font for better readability
      const fontSize = Math.max(asciiFontSize, 10);
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textBaseline = "top";

      const charWidth = fontSize * 0.65;
      const charHeight = fontSize * 1.1;

      // Create offscreen canvas for text rendering
      const offscreen = document.createElement("canvas");
      const offCtx = offscreen.getContext("2d");
      if (!offCtx) return;

      // Make source text larger and bolder for better sampling
      const textFontSize = Math.min(height * 1.2, width / text.length * 2);
      offscreen.width = width;
      offscreen.height = height;

      offCtx.fillStyle = "white";
      offCtx.font = `900 ${textFontSize}px sans-serif`;
      offCtx.textAlign = "center";
      offCtx.textBaseline = "middle";
      offCtx.fillText(text, width / 2, height / 2);

      // Get image data
      const imageData = offCtx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Render ASCII with higher density
      const cols = Math.floor(width / charWidth);
      const rows = Math.floor(height / charHeight);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const sampleX = Math.floor((x / cols) * width);
          const sampleY = Math.floor((y / rows) * height);
          const idx = (sampleY * width + sampleX) * 4;

          const brightness = data[idx + 3] / 255;

          if (brightness > 0.05) {
            // Use the brightest character for better visibility
            let charIndex = Math.floor(brightness * (asciiChars.length - 1));

            // Subtle wave effect - only affects color, not character
            if (enableWaves) {
              const wave = Math.sin(time * 2 + x * 0.2) * 0.3 + 0.7;
              charIndex = Math.min(
                asciiChars.length - 1,
                Math.floor(charIndex * (0.8 + wave * 0.2))
              );
            }

            charIndex = Math.max(1, Math.min(charIndex, asciiChars.length - 1));
            const char = asciiChars[charIndex];

            // Use gradient from primary color with subtle animation
            const hueShift = enableWaves ? Math.sin(time * 1.5 + x * 0.1) * 15 : 0;
            const hue = 280 + hueShift; // Purple range matching primary
            const lightness = 55 + brightness * 15;

            ctx.fillStyle = `hsl(${hue}, 80%, ${lightness}%)`;
            ctx.fillText(char, x * charWidth, y * charHeight);
          }
        }
      }

      time += 0.016;
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [text, enableWaves, asciiFontSize, asciiChars]);

  return (
    <div ref={containerRef} className="w-full h-12 relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ imageRendering: "auto" }}
      />
    </div>
  );
}
