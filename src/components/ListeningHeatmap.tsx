import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { motion } from "framer-motion";

interface DayData {
  date: string;
  minutes: number;
  songs: number;
}

function getIntensity(songs: number): number {
  if (songs === 0) return 0;
  if (songs <= 3) return 1;
  if (songs <= 7) return 2;
  if (songs <= 15) return 3;
  return 4;
}

const intensityColors = [
  "bg-muted/50",
  "bg-yellow-400/50",
  "bg-orange-500/60",
  "bg-rose-500/70",
  "bg-pink-500",
];

export function ListeningHeatmap() {
  const { user } = useAuthStore();
  const [data, setData] = useState<DayData[]>([]);
  const [tooltip, setTooltip] = useState<{ day: DayData; x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data: activity } = await supabase
        .from("user_listening_activity")
        .select("date, minutes_listened, songs_played")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      if (activity) {
        setData(
          (activity as any[]).map((a) => ({
            date: a.date,
            minutes: a.minutes_listened,
            songs: a.songs_played,
          }))
        );
      }
    }
    load();
  }, [user]);

  const { weeks, months } = useMemo(() => {
    const year = 2026;
    const dataMap = new Map(data.map((d) => [d.date, d]));

    const toLocalDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    // Generate Jan 1 to Dec 31 of current year
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const days: DayData[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = toLocalDateStr(d);
      days.push(dataMap.get(dateStr) || { date: dateStr, minutes: 0, songs: 0 });
    }

    // Pad to start on Sunday
    const firstDay = new Date(days[0].date).getDay();
    const padded = Array.from({ length: firstDay }, () => ({
      date: "",
      minutes: 0,
      songs: 0,
    }));
    const allDays = [...padded, ...days];

    // Split into weeks (columns)
    const weeks: DayData[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      const week = allDays.slice(i, i + 7);
      // Pad last week to 7 days
      while (week.length < 7) week.push({ date: "", minutes: 0, songs: 0 });
      weeks.push(week);
    }

    // Get month labels
    const months: { label: string; col: number }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks.length; w++) {
      for (const day of weeks[w]) {
        if (!day.date) continue;
        const m = new Date(day.date).getMonth();
        if (m !== lastMonth) {
          months.push({
            label: new Date(day.date).toLocaleDateString("en-US", { month: "short" }),
            col: w,
          });
          lastMonth = m;
        }
        break;
      }
    }

    return { weeks, months };
  }, [data]);

  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
  const cellSize = 10;
  const cellGap = 2;

  return (
    <div className="relative overflow-hidden">
      {/* Month labels */}
      <div className="flex ml-7 mb-1 text-[10px] text-muted-foreground overflow-hidden">
        {months.map((m, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: 28 + m.col * (cellSize + cellGap),
            }}
            className="min-w-[20px]"
          >
            {m.label}
          </span>
        ))}
      </div>

      <div className="flex gap-0 mt-4">
        {/* Day labels */}
        <div className="flex flex-col gap-[2px] mr-1 text-[10px] text-muted-foreground justify-start flex-shrink-0">
          {dayLabels.map((l, i) => (
            <div key={i} style={{ height: cellSize }} className="flex items-center justify-end w-6">{l}</div>
          ))}
        </div>

        {/* Grid */}
        <div ref={gridRef} className="flex gap-[2px] overflow-x-auto scrollbar-hide flex-1 min-w-0">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[2px] flex-shrink-0">
              {week.map((day, di) => (
                <motion.div
                  key={`${wi}-${di}`}
                  style={{ height: cellSize, width: cellSize }}
                  className={`rounded-[2px] ${day.date ? intensityColors[getIntensity(day.songs)] : "bg-transparent"} cursor-default flex-shrink-0`}
                  whileHover={day.date ? { scale: 1.6 } : {}}
                  onMouseEnter={(e) => {
                    if (!day.date) return;
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    setTooltip({ day, x: rect.left + rect.width / 2, y: rect.top - 8 });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 text-[10px] text-muted-foreground justify-end">
        <span>Less</span>
        {intensityColors.map((c, i) => (
          <div key={i} className={`h-[10px] w-[10px] rounded-[2px] ${c}`} />
        ))}
        <span>More</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
        >
          <p className="font-medium text-foreground">
            {new Date(tooltip.day.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}
          </p>
          <p className="text-muted-foreground">{tooltip.day.songs} song{tooltip.day.songs !== 1 ? "s" : ""} played</p>
          <p className="text-muted-foreground">{Math.round(tooltip.day.minutes)} min listened</p>
        </div>
      )}
    </div>
  );
}
