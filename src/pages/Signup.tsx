import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/layout/Navbar";
import { useAuthStore } from "@/store/authStore";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (authError) {
      toast.error(authError.message);
      setLoading(false);
      return;
    }

    if (avatarFile && authData.user) {
      // Wait briefly for the profile trigger to create the row
      await new Promise(r => setTimeout(r, 1500));

      const fileExt = avatarFile.name.split('.').pop();
      const filePath = `${authData.user.id}/avatar.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, { upsert: true });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        const profileImageUrl = `${urlData.publicUrl}?t=${Date.now()}`;

        // Retry profile update up to 3 times (trigger may be slow)
        for (let attempt = 0; attempt < 3; attempt++) {
          const { error: updateErr } = await supabase
            .from('profiles')
            .update({ profile_image: profileImageUrl })
            .eq('user_id', authData.user.id);
          if (!updateErr) break;
          await new Promise(r => setTimeout(r, 1000));
        }

        // Refresh profile in store
        await useAuthStore.getState().fetchProfile(authData.user.id);
      }
    }

    setLoading(false);
    toast.success("Account created! Welcome to MuzixHub.");
    navigate("/home");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl">
            <BrandLogo className="text-3xl" />
          </h1>
          <p className="mt-2 text-muted-foreground">Create your account and start listening.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-6 space-y-5 border border-border">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative h-20 w-20 rounded-full bg-secondary flex items-center justify-center overflow-hidden border-2 border-border hover:border-primary/50 transition-colors"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-6 w-6 text-muted-foreground" />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="yourname"
                className="w-full bg-secondary rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
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
                className="w-full bg-secondary rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-secondary rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-primary text-primary-foreground font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}