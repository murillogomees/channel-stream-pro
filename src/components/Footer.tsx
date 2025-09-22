import { Separator } from "@/components/ui/separator";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-6 py-8">
        <Separator className="mb-6" />
        <div className="text-center">
          <p className="text-muted-foreground text-sm">
            © 2025 <span className="font-semibold text-primary">IPTV Link</span>. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;