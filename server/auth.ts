import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import MemoryStore from 'memorystore';
import { storage } from './storage';
import { randomBytes, pbkdf2Sync } from 'crypto';

// Create memory store for sessions
const MemoryStoreSession = MemoryStore(session);

// Hash password function
export function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

// Setup passport with local strategy
export function setupAuth(app: express.Express) {
  // Configure Passport
  passport.use(new LocalStrategy(
    async (username: string, password: string, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: 'Incorrect username.' });
        }
        
        // Check password
        const hash = hashPassword(password, user.salt);
        if (hash !== user.password) {
          return done(null, false, { message: 'Incorrect password.' });
        }
        
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));

  // Serialize and deserialize user
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Set up session management
  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'change-this-to-env-variable',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStoreSession({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  });

  // Add middleware
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  return sessionMiddleware;
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized' });
}

// Helper to get user ID from request
export function getUserIdFromRequest(req: Request): number | null {
  if (req.isAuthenticated() && req.user) {
    return (req.user as any).id;
  }
  return null;
}
