import { useEffect } from "react";
import { usePlayerStore } from "@/store/playerStore";

const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function useKeyboardControls() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (INPUT_TAGS.has(tag)) return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const state = usePlayerStore.getState();

      switch (e.key) {
        case " ":
          e.preventDefault();
          state.togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          state.nextSong();
          break;
        case "ArrowLeft":
          e.preventDefault();
          state.prevSong();
          break;
        case "ArrowUp":
          e.preventDefault();
          state.setVolume(Math.min(1, state.volume + 0.05));
          break;
        case "ArrowDown":
          e.preventDefault();
          state.setVolume(Math.max(0, state.volume - 0.05));
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
