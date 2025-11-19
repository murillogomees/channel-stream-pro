import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoSrc: string;
  title: string;
}

const VideoModal = ({ isOpen, onClose, videoSrc, title }: VideoModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full sm:max-w-4xl p-0 bg-background border-2 border-border mx-4">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white h-8 w-8 sm:h-10 sm:w-10"
            onClick={onClose}
          >
            <X className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <div className="p-4 sm:p-6 pb-3 sm:pb-4">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-primary">Trailer: {title}</h3>
          </div>
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            <video
              className="w-full h-auto rounded-lg shadow-elevated"
              controls
              autoPlay
              preload="metadata"
            >
              <source src={videoSrc} type="video/mp4" />
              Seu navegador não suporta o elemento de vídeo.
            </video>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoModal;