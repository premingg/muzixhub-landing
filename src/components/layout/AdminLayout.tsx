import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Upload, Music, ChevronLeft, Disc3, Users, FolderUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { MiniPlayer } from "@/components/layout/MiniPlayer";
import { usePlayerStore } from "@/store/playerStore";

const adminLinks = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/upload", label: "Upload Song", icon: Upload },
  { to: "/admin/upload-album", label: "Upload Album", icon: FolderUp },
  { to: "/admin/songs", label: "Manage Songs", icon: Music },
  { to: "/admin/albums", label: "Manage Albums", icon: Disc3 },
  { to: "/admin/artists", label: "Manage Artists", icon: Users },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { currentSong } = usePlayerStore();

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden md:flex w-[240px] flex-col bg-sidebar border-r border-sidebar-border h-full">
        <div className="p-6">
          <h1 className="text-xl font-display font-bold tracking-tight">
            <span className="text-primary">MuzixHub</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Admin Panel</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {adminLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )
              }
            >
              <link.icon className="h-5 w-5" />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <NavLink to="/home" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" /> Back to App
          </NavLink>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border glass sticky top-0 z-30 flex items-center px-4 md:px-6">
          <h2 className="font-display font-bold text-foreground">Admin Panel</h2>
        </header>
        <main className={cn("flex-1 overflow-y-auto scrollbar-hide", currentSong ? "pb-[88px]" : "")}>
          {children}
        </main>
        {currentSong && <MiniPlayer />}
      </div>
    </div>
  );
}
