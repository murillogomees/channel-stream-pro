import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

interface SectionNavigationProps {
  sections: Array<{
    id: string;
    label: string;
  }>;
}

const SectionNavigation = ({ sections }: SectionNavigationProps) => {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80; // Account for fixed header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-8">
      {sections.map((section, index) => (
        <div key={section.id} className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollToSection(section.id)}
            className="bg-background/50 hover:bg-primary hover:text-primary-foreground transition-all duration-300"
          >
            {section.label}
          </Button>
          {index < sections.length - 1 && (
            <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
          )}
        </div>
      ))}
    </div>
  );
};

export default SectionNavigation;
