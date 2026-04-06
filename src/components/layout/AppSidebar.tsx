import { Home, Compass, Library, Zap, User, Shield } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/layout/Navbar";

const links = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/playlists", label: "Library", icon: Library },
  { to: "/pulse", label: "Pulse", icon: Zap },
  { to: "/profile", label: "Profile", icon: User },
];

const sidebarItem = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0 },
};

const sidebarContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

export function AppSidebar() {
  const { isAdmin } = useAuthStore();

  return (
    <aside className="hidden md:flex w-[240px] flex-col bg-sidebar border-r border-sidebar-border h-full">
      <motion.div
        className="p-6"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <h1 className="text-2xl">
          <BrandLogo className="text-2xl" />
        </h1>
      </motion.div>

      <motion.nav
        className="flex-1 px-3 space-y-1"
        variants={sidebarContainer}
        initial="hidden"
        animate="show"
      >
        {links.map((link) => (
          <motion.div key={link.to} variants={sidebarItem}>
            <NavLink
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
              {({ isActive }) => (
                <>
                  <motion.div whileHover={{ scale: 1.2, rotate: 8 }} whileTap={{ scale: 0.9 }}>
                    <link.icon className="h-5 w-5" />
                  </motion.div>
                  <span>{link.label}</span>
                  {isActive && (
                    <motion.div
                      className="ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                      layoutId="sidebar-indicator"
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          </motion.div>
        ))}

        {isAdmin && (
          <motion.div variants={sidebarItem}>
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mt-4",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-primary hover:bg-sidebar-accent/50"
                )
              }
            >
              <motion.div whileHover={{ scale: 1.2, rotate: -8 }} whileTap={{ scale: 0.9 }}>
                <Shield className="h-5 w-5" />
              </motion.div>
              <span>Admin Panel</span>
            </NavLink>
          </motion.div>
        )}
      </motion.nav>
    </aside>
  );
}
