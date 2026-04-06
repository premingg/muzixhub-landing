import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Loader2, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/layout/Navbar";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"user" | "admin">("user");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (role === "admin" && authData.user) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: authData.user.id,
        _role: "admin",
      });

      if (!isAdmin) {
        await supabase.auth.signOut();
        toast.error("You do not have admin privileges.");
        setLoading(false);
        return;
      }

      setLoading(false);
      navigate("/admin/dashboard");
      return;
    }

    setLoading(false);
    navigate("/home");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-3xl">
            <BrandLogo className="text-4xl md:text-3xl" />
          </h1>
          <p className="mt-2 text-muted-foreground">Welcome back! Sign in to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-3xl p-6 md:p-6 space-y-5 border border-border/50">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">I am a</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("user")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all border min-h-[48px] ${
                  role === "user"
                    ? "gradient-primary text-primary-foreground border-transparent glow-shadow"
                    : "bg-secondary text-muted-foreground border-border active:border-primary/30"
                }`}
              >
                <User className="h-4 w-4" />
                User
              </button>
              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all border min-h-[48px] ${
                  role === "admin"
                    ? "gradient-primary text-primary-foreground border-transparent glow-shadow"
                    : "bg-secondary text-muted-foreground border-border active:border-primary/30"
                }`}
              >
                <Shield className="h-4 w-4" />
                Admin
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-secondary rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[48px]"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-secondary rounded-xl pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[48px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground active:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-primary text-primary-foreground font-medium py-3 rounded-xl active:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Signing in..." : `Sign in as ${role === "admin" ? "Admin" : "User"}`}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary active:underline">Sign up</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
