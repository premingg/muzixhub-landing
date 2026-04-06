import { NavLink, useLocation } from "react-router-dom";
import { Home, Compass, Library, Zap, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";

const tabs = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/playlists", label: "Library", icon: Library },
  { to: "/pulse", label: "Pulse", icon: Zap },
  { to: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const location = useLocation();
  const { showFullPlayer, toggleFullPlayer } = usePlayerStore();

  if (showFullPlayer) return null;

  const handleNavClick = () => {
    if (showFullPlayer) toggleFullPlayer();
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-xl border-t border-border/50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.to || location.pathname.startsWith(tab.to + "/");
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              onClick={handleNavClick}
              className="flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] active:scale-95 transition-transform"
            >
              <tab.icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
