import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowRight, Compass } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Compass className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h1 className="text-7xl font-bold text-primary tracking-tight">404</h1>
          <h2 className="mt-4 text-2xl font-semibold text-foreground">העמוד לא נמצא</h2>
          <p className="mt-2 text-muted-foreground">
            הקישור שביקרת בו לא קיים או הוסר.
            <br />
            <span className="text-xs font-mono opacity-60">{location.pathname}</span>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link to="/dashboard">
              <Home className="ml-2" size={16} />
              לדשבורד
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">
              לדף הבית
              <ArrowRight className="mr-2" size={16} />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
