/**
 * useViewerProfiles - Hook para gerenciar perfis de visualização (estilo Netflix)
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ViewerProfile {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  avatar_color: string | null;
  is_kids: boolean;
  pin_code: string | null;
  language: string;
  maturity_rating: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface CreateProfileInput {
  name: string;
  avatar_url?: string;
  avatar_color?: string;
  is_kids?: boolean;
  pin_code?: string;
  language?: string;
  maturity_rating?: string;
}

export interface UpdateProfileInput extends Partial<CreateProfileInput> {
  id: string;
}

const DEFAULT_AVATARS = [
  { color: "#E50914", emoji: "😀" },
  { color: "#1DB954", emoji: "😎" },
  { color: "#0077B5", emoji: "🎮" },
  { color: "#FF6B35", emoji: "🎬" },
  { color: "#9B59B6", emoji: "📺" },
  { color: "#F39C12", emoji: "⭐" },
];

export function useViewerProfiles() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ViewerProfile[]>([]);
  const [activeProfile, setActiveProfileState] = useState<ViewerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all profiles for the current user
  const fetchProfiles = useCallback(async () => {
    if (!user?.id) {
      setProfiles([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("viewer_profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;

      setProfiles(data || []);

      // Restore active profile from localStorage or set first profile
      const storedProfileId = localStorage.getItem(`active_profile_${user.id}`);
      if (storedProfileId && data) {
        const storedProfile = data.find(p => p.id === storedProfileId);
        if (storedProfile) {
          setActiveProfileState(storedProfile);
        } else if (data.length > 0) {
          setActiveProfileState(data[0]);
        }
      } else if (data && data.length > 0) {
        setActiveProfileState(data[0]);
      }
    } catch (err: any) {
      console.error("Error fetching viewer profiles:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Create a new profile
  const createProfile = useCallback(async (input: CreateProfileInput): Promise<ViewerProfile | null> => {
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return null;
    }

    // Check profile limit (max 5 like Netflix)
    if (profiles.length >= 5) {
      toast.error("Limite de 5 perfis atingido");
      return null;
    }

    try {
      const randomAvatar = DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];

      const { data, error: createError } = await supabase
        .from("viewer_profiles")
        .insert({
          user_id: user.id,
          name: input.name,
          avatar_url: input.avatar_url || null,
          avatar_color: input.avatar_color || randomAvatar.color,
          is_kids: input.is_kids || false,
          pin_code: input.pin_code || null,
          language: input.language || "pt-BR",
          maturity_rating: input.maturity_rating || "all",
        })
        .select()
        .single();

      if (createError) throw createError;

      toast.success("Perfil criado com sucesso");
      await fetchProfiles();
      return data;
    } catch (err: any) {
      console.error("Error creating profile:", err);
      toast.error("Erro ao criar perfil", { description: err.message });
      return null;
    }
  }, [user?.id, profiles.length, fetchProfiles]);

  // Update an existing profile
  const updateProfile = useCallback(async (input: UpdateProfileInput): Promise<boolean> => {
    try {
      const { id, ...updates } = input;

      const { error: updateError } = await supabase
        .from("viewer_profiles")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

      toast.success("Perfil atualizado");
      await fetchProfiles();
      return true;
    } catch (err: any) {
      console.error("Error updating profile:", err);
      toast.error("Erro ao atualizar perfil", { description: err.message });
      return false;
    }
  }, [fetchProfiles]);

  // Delete a profile
  const deleteProfile = useCallback(async (profileId: string): Promise<boolean> => {
    if (profiles.length <= 1) {
      toast.error("Você precisa ter pelo menos 1 perfil");
      return false;
    }

    try {
      const { error: deleteError } = await supabase
        .from("viewer_profiles")
        .delete()
        .eq("id", profileId);

      if (deleteError) throw deleteError;

      // If deleted profile was active, switch to another
      if (activeProfile?.id === profileId) {
        const remaining = profiles.filter(p => p.id !== profileId);
        if (remaining.length > 0) {
          setActiveProfile(remaining[0]);
        }
      }

      toast.success("Perfil removido");
      await fetchProfiles();
      return true;
    } catch (err: any) {
      console.error("Error deleting profile:", err);
      toast.error("Erro ao remover perfil", { description: err.message });
      return false;
    }
  }, [profiles, activeProfile?.id, fetchProfiles]);

  // Set active profile
  const setActiveProfile = useCallback((profile: ViewerProfile) => {
    if (!user?.id) return;

    setActiveProfileState(profile);
    localStorage.setItem(`active_profile_${user.id}`, profile.id);

    // Update last_used_at
    supabase
      .from("viewer_profiles")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", profile.id)
      .then(() => {});
  }, [user?.id]);

  // Verify PIN code
  const verifyPin = useCallback(async (profileId: string, pin: string): Promise<boolean> => {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return false;
    
    if (!profile.pin_code) return true;
    return profile.pin_code === pin;
  }, [profiles]);

  // Initial fetch
  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return {
    profiles,
    activeProfile,
    isLoading,
    error,
    createProfile,
    updateProfile,
    deleteProfile,
    setActiveProfile,
    verifyPin,
    refresh: fetchProfiles,
    defaultAvatars: DEFAULT_AVATARS,
    maxProfiles: 5,
  };
}
