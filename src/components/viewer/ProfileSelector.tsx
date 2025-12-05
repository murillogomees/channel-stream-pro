/**
 * ProfileSelector - Seletor de perfis estilo Netflix
 */

import { useState } from "react";
import { useViewerProfiles, ViewerProfile, CreateProfileInput } from "@/hooks/useViewerProfiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, Lock, Baby, User } from "lucide-react";

interface ProfileSelectorProps {
  onSelectProfile: (profile: ViewerProfile) => void;
  showManage?: boolean;
}

export function ProfileSelector({ onSelectProfile, showManage = true }: ProfileSelectorProps) {
  const {
    profiles,
    isLoading,
    createProfile,
    updateProfile,
    deleteProfile,
    verifyPin,
    defaultAvatars,
    maxProfiles,
  } = useViewerProfiles();

  const [isManaging, setIsManaging] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ViewerProfile | null>(null);
  const [pinDialogProfile, setPinDialogProfile] = useState<ViewerProfile | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(defaultAvatars[0].color);
  const [formIsKids, setFormIsKids] = useState(false);
  const [formPin, setFormPin] = useState("");

  const handleProfileClick = async (profile: ViewerProfile) => {
    if (isManaging) {
      setEditingProfile(profile);
      setFormName(profile.name);
      setFormColor(profile.avatar_color || defaultAvatars[0].color);
      setFormIsKids(profile.is_kids);
      setFormPin(profile.pin_code || "");
      return;
    }

    // Check if PIN is required
    if (profile.pin_code) {
      setPinDialogProfile(profile);
      setPinInput("");
      setPinError(false);
      return;
    }

    onSelectProfile(profile);
  };

  const handlePinSubmit = async () => {
    if (!pinDialogProfile) return;

    const isValid = await verifyPin(pinDialogProfile.id, pinInput);
    if (isValid) {
      setPinDialogProfile(null);
      setPinInput("");
      onSelectProfile(pinDialogProfile);
    } else {
      setPinError(true);
    }
  };

  const handleCreateProfile = async () => {
    if (!formName.trim()) return;

    const input: CreateProfileInput = {
      name: formName.trim(),
      avatar_color: formColor,
      is_kids: formIsKids,
      pin_code: formPin || undefined,
    };

    const created = await createProfile(input);
    if (created) {
      setCreateDialogOpen(false);
      resetForm();
    }
  };

  const handleUpdateProfile = async () => {
    if (!editingProfile || !formName.trim()) return;

    await updateProfile({
      id: editingProfile.id,
      name: formName.trim(),
      avatar_color: formColor,
      is_kids: formIsKids,
      pin_code: formPin || null,
    });

    setEditingProfile(null);
    resetForm();
  };

  const handleDeleteProfile = async () => {
    if (!editingProfile) return;

    const confirmed = window.confirm(`Tem certeza que deseja excluir o perfil "${editingProfile.name}"?`);
    if (confirmed) {
      await deleteProfile(editingProfile.id);
      setEditingProfile(null);
      resetForm();
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormColor(defaultAvatars[0].color);
    setFormIsKids(false);
    setFormPin("");
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Carregando perfis...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <h1 className="text-3xl font-bold mb-8">Quem está assistindo?</h1>

      <div className="flex flex-wrap justify-center gap-6 mb-8">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            onClick={() => handleProfileClick(profile)}
            className="group flex flex-col items-center gap-2 transition-transform hover:scale-105"
          >
            <div
              className={cn(
                "relative w-24 h-24 rounded-lg flex items-center justify-center text-4xl transition-all",
                "border-2 border-transparent group-hover:border-white",
                isManaging && "ring-2 ring-primary"
              )}
              style={{ backgroundColor: profile.avatar_color || "#333" }}
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : profile.is_kids ? (
                <Baby className="w-12 h-12 text-white" />
              ) : (
                <User className="w-12 h-12 text-white" />
              )}

              {/* Lock icon for PIN protected */}
              {profile.pin_code && !isManaging && (
                <div className="absolute bottom-1 right-1 bg-black/50 rounded-full p-1">
                  <Lock className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Edit overlay when managing */}
              {isManaging && (
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                  <Pencil className="w-8 h-8 text-white" />
                </div>
              )}
            </div>

            <span className="text-sm text-muted-foreground group-hover:text-foreground">
              {profile.name}
            </span>

            {profile.is_kids && (
              <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded">
                Kids
              </span>
            )}
          </button>
        ))}

        {/* Add profile button */}
        {profiles.length < maxProfiles && (
          <button
            onClick={openCreateDialog}
            className="group flex flex-col items-center gap-2 transition-transform hover:scale-105"
          >
            <div className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center group-hover:border-primary">
              <Plus className="w-12 h-12 text-muted-foreground group-hover:text-primary" />
            </div>
            <span className="text-sm text-muted-foreground group-hover:text-foreground">
              Adicionar
            </span>
          </button>
        )}
      </div>

      {/* Manage profiles button */}
      {showManage && profiles.length > 0 && (
        <Button
          variant={isManaging ? "default" : "outline"}
          onClick={() => setIsManaging(!isManaging)}
        >
          {isManaging ? "Concluído" : "Gerenciar Perfis"}
        </Button>
      )}

      {/* Create/Edit Profile Dialog */}
      <Dialog
        open={createDialogOpen || !!editingProfile}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditingProfile(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? "Editar Perfil" : "Criar Novo Perfil"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nome do perfil"
                maxLength={20}
              />
            </div>

            <div className="space-y-2">
              <Label>Cor do Avatar</Label>
              <div className="flex gap-2 flex-wrap">
                {defaultAvatars.map((avatar) => (
                  <button
                    key={avatar.color}
                    onClick={() => setFormColor(avatar.color)}
                    className={cn(
                      "w-10 h-10 rounded-full transition-all",
                      formColor === avatar.color && "ring-2 ring-white ring-offset-2 ring-offset-background"
                    )}
                    style={{ backgroundColor: avatar.color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Perfil Infantil</Label>
                <p className="text-xs text-muted-foreground">
                  Restringe conteúdo para crianças
                </p>
              </div>
              <Switch
                checked={formIsKids}
                onCheckedChange={setFormIsKids}
              />
            </div>

            <div className="space-y-2">
              <Label>PIN de Bloqueio (opcional)</Label>
              <Input
                type="password"
                value={formPin}
                onChange={(e) => setFormPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="4 dígitos"
                maxLength={4}
              />
              <p className="text-xs text-muted-foreground">
                Proteja este perfil com um PIN de 4 dígitos
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {editingProfile && (
              <Button
                variant="destructive"
                onClick={handleDeleteProfile}
                className="mr-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setEditingProfile(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={editingProfile ? handleUpdateProfile : handleCreateProfile}
              disabled={!formName.trim()}
            >
              {editingProfile ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN Dialog */}
      <Dialog open={!!pinDialogProfile} onOpenChange={() => setPinDialogProfile(null)}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="text-center">
              Digite o PIN para {pinDialogProfile?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            <InputOTP
              maxLength={4}
              value={pinInput}
              onChange={(value) => {
                setPinInput(value);
                setPinError(false);
              }}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>

            {pinError && (
              <p className="text-sm text-destructive">PIN incorreto</p>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={handlePinSubmit}
              disabled={pinInput.length !== 4}
              className="w-full"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
