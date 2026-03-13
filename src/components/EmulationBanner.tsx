import { useEmulation } from "@/contexts/EmulationContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Eye, X } from "lucide-react";

export function EmulationBanner() {
  const { emulatedEmail, stopEmulation } = useEmulation();
  const navigate = useNavigate();

  if (!emulatedEmail) return null;

  const handleExit = () => {
    stopEmulation();
    navigate("/dashboard");
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between bg-primary px-4 py-2 text-primary-foreground">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span className="text-sm font-medium">
          Viewing as <strong>{emulatedEmail}</strong>
        </span>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleExit}
        className="h-7 gap-1"
      >
        <X className="h-3 w-3" />
        Exit View
      </Button>
    </div>
  );
}
