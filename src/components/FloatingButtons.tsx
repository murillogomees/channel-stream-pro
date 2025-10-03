import { MessageCircle, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";

const FloatingButtons = () => {
  const whatsappNumber = "556132425880";
  const whatsappMessage = "Olá! Gostaria de saber mais sobre os planos IPTV.";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
  const instagramUrl = "https://instagram.com/iptvlinkbr";

  return (
    <div className="fixed right-6 bottom-6 z-50 flex flex-col gap-3">
      {/* WhatsApp Button */}
      <Button
        variant="default"
        size="icon"
        className="h-14 w-14 rounded-full shadow-glow hover:shadow-elevated hover:scale-110 transition-all"
        onClick={() => window.open(whatsappUrl, "_blank")}
        aria-label="Falar no WhatsApp"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {/* Instagram Button */}
      <Button
        variant="premium"
        size="icon"
        className="h-14 w-14 rounded-full shadow-glow hover:shadow-elevated hover:scale-110 transition-all"
        onClick={() => window.open(instagramUrl, "_blank")}
        aria-label="Seguir no Instagram"
      >
        <Instagram className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default FloatingButtons;
