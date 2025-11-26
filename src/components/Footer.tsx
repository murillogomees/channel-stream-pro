import { Separator } from "@/components/ui/separator";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Separator className="mb-4 sm:mb-6" />
        <div className="text-center">
          <p className="text-muted-foreground text-xs sm:text-sm px-2">
            © 2025 <span className="font-semibold text-foreground">IPTV Link</span>. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;