import { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useUser } from './UserContext';
import { useToast } from '@/hooks/use-toast';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, loading } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to access this page.',
        variant: 'destructive',
      });
      setLocation('/login');
    }
  }, [isAuthenticated, loading, setLocation, toast]);

  // If still loading, show nothing or a loading spinner
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If authenticated, render the children
  return isAuthenticated ? <>{children}</> : null;
}
