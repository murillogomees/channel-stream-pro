import { MessageCircle, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/services/metaPixelService";

const FloatingButtons = () => {
  const whatsappUrl = "https://wa.me/556131425880?text=Olá%21+Gostaria+de+fazer+o+teste+grátis+do+IPTV";
  const instagramUrl = "https://instagram.com/iptvlinkbr";

  return (
    <div className="fixed right-4 sm:right-6 bottom-20 sm:bottom-24 lg:bottom-[7.5rem] z-50 flex flex-col gap-2 sm:gap-3">
      {/* WhatsApp Button */}
      <Button
        variant="default"
        size="icon"
        className="h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-glow hover:shadow-elevated hover:scale-110 transition-all"
        onClick={() => {
          trackEvent('Contact', { content_name: 'Floating WhatsApp Button', content_category: 'button' });
          window.open(whatsappUrl, "_blank");
        }}
        aria-label="Falar no WhatsApp"
      >
        <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>

      {/* Instagram Button */}
      <button
        className="h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-glow hover:shadow-elevated hover:scale-110 transition-all bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white flex items-center justify-center"
        onClick={() => {
          trackEvent('ViewContent', { content_name: 'Instagram Profile', content_type: 'social_media' });
          window.open(instagramUrl, "_blank");
        }}
        aria-label="Seguir no Instagram"
      >
        <Instagram className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>
    </div>
  );
};

export default FloatingButtons;
