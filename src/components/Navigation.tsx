import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Tv, Phone, MessageCircle } from "lucide-react";
import { useSettingsContext } from "@/context/SettingsContext";
const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const {
    settings
  } = useSettingsContext();
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return <nav className={`fixed top-0 w-full z-50 transition-smooth ${isScrolled ? "bg-background/95 backdrop-blur-lg shadow-card border-b border-border" : "bg-transparent"}`}>
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {settings.header.logo.image ? <div className="flex items-center gap-3">
                <img src={settings.header.logo.image} alt={settings.header.logo.text} className="h-10 w-auto" style={{
              filter: 'brightness(0) invert(1)'
            }} />
                <span className="text-xl font-bold text-white">
                  {settings.header.logo.text}
                </span>
              </div> : <>
                <div className="p-2 bg-gradient-primary rounded-lg shadow-glow">
                  <Tv className="h-6 w-6 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-gradient-primary">
                  {settings.header.logo.text}
                </span>
              </>}
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {settings.header.navigation.map(item => <a key={item.id} href={item.href} className="text-foreground hover:text-primary transition-smooth font-medium">
                {item.label}
              </a>)}
          </div>

          {/* Desktop CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            
            <Button variant="default" size="sm" onClick={() => window.open(`https://wa.me/${settings.contact.info.whatsapp}`, '_blank')}>
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 rounded-lg hover:bg-secondary transition-smooth" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-lg">
            <div className="py-4 space-y-4">
              {settings.header.navigation.map(item => <a key={item.id} href={item.href} className="block px-4 py-2 text-foreground hover:text-primary hover:bg-secondary rounded-lg transition-smooth" onClick={() => setIsOpen(false)}>
                  {item.label}
                </a>)}
              <div className="px-4 pt-4 space-y-2">
                <Button variant="outline" size="sm" className="w-full">
                  <Phone className="h-4 w-4" />
                  Contato
                </Button>
                <Button variant="default" size="sm" className="w-full">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
              </div>
            </div>
          </div>}
      </div>
    </nav>;
};
export default Navigation;