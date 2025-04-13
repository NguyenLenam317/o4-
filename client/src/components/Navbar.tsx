import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useUser } from './UserContext';

export function Navbar() {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, logout } = useUser();

  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };

  return (
    <nav className="border-b bg-background">
      <div className="container flex h-16 items-center px-4 sm:px-6">
        <div className="mr-4 flex">
          <Link href="/">
            <a className="flex items-center">
              <span className="font-bold text-xl">Climate App</span>
            </a>
          </Link>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex gap-6 md:gap-10">
              <Link href="/">
                <a className={`text-sm font-medium ${location === '/' ? 'text-primary' : 'text-foreground/60'} transition-colors hover:text-primary`}>
                  Home
                </a>
              </Link>
              <Link href="/weather">
                <a className={`text-sm font-medium ${location === '/weather' ? 'text-primary' : 'text-foreground/60'} transition-colors hover:text-primary`}>
                  Weather
                </a>
              </Link>
              <Link href="/health">
                <a className={`text-sm font-medium ${location === '/health' ? 'text-primary' : 'text-foreground/60'} transition-colors hover:text-primary`}>
                  Health
                </a>
              </Link>
              <Link href="/climate">
                <a className={`text-sm font-medium ${location === '/climate' ? 'text-primary' : 'text-foreground/60'} transition-colors hover:text-primary`}>
                  Climate
                </a>
              </Link>
              <Link href="/activities">
                <a className={`text-sm font-medium ${location === '/activities' ? 'text-primary' : 'text-foreground/60'} transition-colors hover:text-primary`}>
                  Activities
                </a>
              </Link>
              <Link href="/community">
                <a className={`text-sm font-medium ${location === '/community' ? 'text-primary' : 'text-foreground/60'} transition-colors hover:text-primary`}>
                  Community
                </a>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <span className="text-sm mr-2">
                    Welcome, {user?.username}
                  </span>
                  <Button variant="outline" onClick={handleLogout}>
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setLocation('/login')}>
                    Sign In
                  </Button>
                  <Button onClick={() => setLocation('/register')}>
                    Sign Up
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
