import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Play } from "lucide-react";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoSrc: string;
  title: string;
}

const VideoModal = ({ isOpen, onClose, videoSrc, title }: VideoModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full sm:max-w-4xl p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>
            <Play className="h-5 w-5" />
            Trailer: {title}
          </DialogTitle>
          <DialogDescription>
            Assista ao trailer completo do conteúdo
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">
          <video
            className="w-full h-auto rounded-lg shadow-elevated bg-black"
            controls
            autoPlay
            preload="metadata"
          >
            <source src={videoSrc} type="video/mp4" />
            Seu navegador não suporta o elemento de vídeo.
          </video>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoModal;
