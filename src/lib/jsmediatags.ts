// Load jsmediatags lazily at runtime to avoid build-time resolution issues
// and to ensure the library is only used in the browser environment.
type JsMediaTags = {
  read: (
    file: File,
    callbacks: {
      onSuccess?: (tag: unknown) => void;
      onError?: (err: unknown) => void;
    }
  ) => void;
};

let loaded: JsMediaTags | undefined;

async function loadJsMediaTags(): Promise<JsMediaTags | undefined> {
  if (loaded) return loaded;
  if (typeof window === "undefined") return undefined;
  // dynamic import ensures Vite doesn't try to resolve this during SSR/build
  const mod = await import("jsmediatags/dist/jsmediatags.min.js");
  // the library may export as default or as the module itself
  const m = (mod as any).default ?? (mod as any);
  if (m?.read) {
    loaded = m as JsMediaTags;
    return loaded;
  }
  return undefined;
}

const jsmediatags: JsMediaTags = {
  read(file, callbacks) {
    if (typeof window === "undefined") {
      callbacks.onError?.(new Error("jsmediatags not available in non-browser environment"));
      return;
    }
    loadJsMediaTags()
      .then((m) => {
        if (!m?.read) {
          callbacks.onError?.(new Error("Failed to load jsmediatags"));
          return;
        }
        m.read(file, callbacks);
      })
      .catch((err) => callbacks.onError?.(err));
  },
};

export default jsmediatags;
