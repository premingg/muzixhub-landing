import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { Plus, X, Trash2, Image, Pencil, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Artist {
  id: string;
  name: string;
  image_url: string | null;
  bio: string | null;
  created_at: string;
}

export default function AdminArtists() {
  const { user } = useAuthStore();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [form, setForm] = useState({ name: "", bio: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Artist | null>(null);

  const fetchArtists = async () => {
    const { data } = await supabase
      .from("artists")
      .select("*")
      .order("name");
    setArtists((data as Artist[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchArtists(); }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const openEdit = (artist: Artist) => {
    setEditingArtist(artist);
    setForm({ name: artist.name, bio: artist.bio || "" });
    setImagePreview(artist.image_url);
    setImageFile(null);
    setShowForm(true);
  };

  const openCreate = () => {
    setEditingArtist(null);
    setForm({ name: "", bio: "" });
    setImagePreview(null);
    setImageFile(null);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("Artist name is required"); return; }
    setSaving(true);

    try {
      let imageUrl: string | null = editingArtist?.image_url || null;

      const artistId = editingArtist?.id || crypto.randomUUID();

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `artists/${artistId}/image.${ext}`;
        const { error } = await supabase.storage.from("covers").upload(path, imageFile, { upsert: true });
        if (error) throw error;
        imageUrl = supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
      }

      if (editingArtist) {
        const { error } = await supabase
          .from("artists")
          .update({ name: form.name.trim(), bio: form.bio.trim() || null, image_url: imageUrl })
          .eq("id", editingArtist.id);
        if (error) throw error;
        toast.success("Artist updated!");
      } else {
        const { error } = await supabase
          .from("artists")
          .insert({ id: artistId, name: form.name.trim(), bio: form.bio.trim() || null, image_url: imageUrl, created_by: user?.id });
        if (error) {
          if (error.code === "23505") toast.error("Artist already exists");
          else throw error;
          setSaving(false);
          return;
        }
        toast.success("Artist added!");
      }

      setShowForm(false);
      fetchArtists();
    } catch (err: any) {
      toast.error(err.message || "Failed to save artist");
    } finally {
      setSaving(false);
    }
  };

  const deleteArtist = async (id: string) => {
    const { error } = await supabase.from("artists").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Artist deleted");
    fetchArtists();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">Manage Artists</h1>
        <button
          onClick={openCreate}
          className="gradient-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add Artist
        </button>
      </div>

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-5 w-full max-w-md space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-display font-semibold text-foreground">
                  {editingArtist ? "Edit Artist" : "Add Artist"}
                </h3>
                <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Image */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => imageRef.current?.click()}
                  className="h-20 w-20 rounded-full bg-secondary border-2 border-dashed border-border hover:border-primary/50 transition-colors flex items-center justify-center overflow-hidden flex-shrink-0"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Image className="h-6 w-6 text-muted-foreground" />
                  )}
                </button>
                <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                <p className="text-xs text-muted-foreground">Click to upload artist image</p>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Artist name"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Bio</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="Short bio..."
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full gradient-primary text-primary-foreground font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingArtist ? "Save Changes" : "Add Artist"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Artist list */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-3 animate-pulse">
              <div className="aspect-square rounded-full bg-secondary mb-3 mx-auto w-3/4" />
              <div className="h-4 bg-secondary rounded w-2/3 mx-auto" />
            </div>
          ))}
        </div>
      ) : artists.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No artists yet. Add your first artist!</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {artists.map((artist) => (
            <div
              key={artist.id}
              className="group relative bg-card hover:bg-secondary/80 rounded-xl p-4 transition-colors text-center"
            >
              <div className="aspect-square rounded-full bg-secondary overflow-hidden mb-3 mx-auto w-3/4">
                {artist.image_url ? (
                  <img src={artist.image_url} alt={artist.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full gradient-primary opacity-30" />
                )}
              </div>
              <h3 className="text-sm font-medium text-foreground truncate">{artist.name}</h3>
              {artist.bio && <p className="text-xs text-muted-foreground truncate mt-0.5">{artist.bio}</p>}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(artist)}
                  className="p-1.5 rounded-full bg-secondary hover:bg-primary/20 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5 text-foreground" />
                </button>
                <button
                  onClick={() => setDeleteConfirm(artist)}
                  className="p-1.5 rounded-full bg-secondary hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Artist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteConfirm) deleteArtist(deleteConfirm.id); setDeleteConfirm(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
