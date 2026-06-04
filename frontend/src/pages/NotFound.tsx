import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div className="max-w-md space-y-4">
        <div className="num text-7xl font-semibold tracking-tight text-primary">404</div>
        <h1 className="text-2xl font-semibold tracking-tight">We couldn't find that page</h1>
        <p className="text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has moved. Try the home page instead.
        </p>
        <Button asChild className="gap-2 rounded-xl">
          <Link to="/">
            <ArrowLeft className="size-4" />
            Back to overview
          </Link>
        </Button>
      </div>
    </div>
  );
}
