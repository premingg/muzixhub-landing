import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, ProtectedRoute, AdminRoute } from "@/components/auth/AuthProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import Index from "./pages/Index";
import HomePage from "./pages/HomePage";
import Explore from "./pages/Explore";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Playlists from "./pages/Playlists";
import Pulse from "./pages/Pulse";
import AlbumView from "./pages/AlbumView";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUpload from "./pages/admin/AdminUpload";
import AdminBulkUpload from "./pages/admin/AdminBulkUpload";
import AdminSongs from "./pages/admin/AdminSongs";
import AdminAlbums from "./pages/admin/AdminAlbums";
import AdminAlbumUpload from "./pages/admin/AdminAlbumUpload";
import AdminArtists from "./pages/admin/AdminArtists";
import PublicSongPage from "./pages/PublicSongPage";
import PublicPlaylistPage from "./pages/PublicPlaylistPage";
import PublicArtistPage from "./pages/PublicArtistPage";
import NotFound from "./pages/NotFound";
import MoodPlaylist from "./pages/MoodPlaylist";
import SearchResults from "./pages/SearchResults";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            {/* Public shareable pages */}
            <Route path="/song/:id" element={<AppLayout><PublicSongPage /></AppLayout>} />
            <Route path="/playlist/:id" element={<AppLayout><PublicPlaylistPage /></AppLayout>} />
            <Route path="/artist/:id" element={<AppLayout><PublicArtistPage /></AppLayout>} />
            {/* Protected routes */}
            <Route path="/home" element={<ProtectedRoute><AppLayout><HomePage /></AppLayout></ProtectedRoute>} />
            <Route path="/explore" element={<ProtectedRoute><AppLayout><Explore /></AppLayout></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><AppLayout><SearchResults /></AppLayout></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
            <Route path="/playlists" element={<ProtectedRoute><AppLayout><Playlists /></AppLayout></ProtectedRoute>} />
            <Route path="/pulse" element={<ProtectedRoute><AppLayout><Pulse /></AppLayout></ProtectedRoute>} />
            <Route path="/mood/:moodId" element={<ProtectedRoute><AppLayout><MoodPlaylist /></AppLayout></ProtectedRoute>} />
            <Route path="/album/:albumName" element={<ProtectedRoute><AppLayout><AlbumView /></AppLayout></ProtectedRoute>} />
            {/* Admin routes */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminRoute>} />
            <Route path="/admin/upload" element={<AdminRoute><AdminLayout><AdminUpload /></AdminLayout></AdminRoute>} />
            <Route path="/admin/bulk-upload" element={<AdminRoute><AdminLayout><AdminBulkUpload /></AdminLayout></AdminRoute>} />
            <Route path="/admin/upload-album" element={<AdminRoute><AdminLayout><AdminAlbumUpload /></AdminLayout></AdminRoute>} />
            <Route path="/admin/songs" element={<AdminRoute><AdminLayout><AdminSongs /></AdminLayout></AdminRoute>} />
            <Route path="/admin/albums" element={<AdminRoute><AdminLayout><AdminAlbums /></AdminLayout></AdminRoute>} />
            <Route path="/admin/artists" element={<AdminRoute><AdminLayout><AdminArtists /></AdminLayout></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
