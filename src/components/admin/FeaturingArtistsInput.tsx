import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function FeaturingArtistsInput({ value, onChange, placeholder, className }: Props) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    if (value.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, v]);
    setDraft("");
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      remove(value.length - 1);
    }
  };

  return (
    <div
      className={
        "flex flex-wrap gap-1.5 items-center bg-secondary rounded-lg px-2 py-1.5 focus-within:ring-2 focus-within:ring-primary/50 " +
        (className || "")
      }
    >
      {value.map((artist, idx) => (
        <span
          key={`${artist}-${idx}`}
          className="inline-flex items-center gap-1 bg-primary/15 text-primary text-xs font-medium px-2 py-1 rounded-full"
        >
          {artist}
          <button type="button" onClick={() => remove(idx)} className="hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={value.length === 0 ? placeholder || "Type artist name and press Enter" : ""}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none px-1 py-1"
      />
    </div>
  );
}
