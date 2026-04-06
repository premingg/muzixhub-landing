import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { useKeyboardControls } from "@/hooks/useKeyboardControls";
import { Navbar } from "./Navbar";
import { MiniPlayer } from "./MiniPlayer";
import { FullPlayer } from "@/components/player/FullPlayer";
import { QueuePanel } from "@/components/player/QueuePanel";
import { BottomNav } from "./BottomNav";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  useKeyboardControls();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 overflow-y-auto pb-36 md:pb-24 scrollbar-hide">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <MiniPlayer />
      <FullPlayer />
      <QueuePanel />
      <BottomNav />
    </div>
  );
}
