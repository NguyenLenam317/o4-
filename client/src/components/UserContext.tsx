import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserProfile } from '@/types';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface UserContextType {
  user: User | null;
  loading: boolean;
  hasSurveyCompleted: boolean;
  setHasSurveyCompleted: (value: boolean) => void;
  updateUserProfile: (profile: UserProfile) => Promise<void>;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  hasSurveyCompleted: false,
  setHasSurveyCompleted: () => {},
  updateUserProfile: async () => {},
  isAuthenticated: false,
  login: async () => false,
  register: async () => false,
  logout: async () => {},
  fetchUser: async () => {},
});

export const useUser = () => useContext(UserContext);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider = ({ children }: UserProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSurveyCompleted, setHasSurveyCompleted] = useState(false);
  const { toast } = useToast();

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/current-user', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setHasSurveyCompleted(userData.hasSurveyCompleted || false);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const updateUserProfile = async (profile: UserProfile) => {
    try {
      const response = await apiRequest('POST', '/api/user/profile', profile);
      if (response.ok) {
        const updatedUser = await response.json();
        setUser(prevUser => prevUser ? { ...prevUser, userProfile: updatedUser.userProfile } : null);
        toast({
          title: 'Profile Updated',
          description: 'Your profile has been successfully updated.',
        });
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update your profile. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await apiRequest('POST', '/api/auth/login', { username, password });
      if (response.ok) {
        await fetchUser();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error logging in:', error);
      return false;
    }
  };

  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    try {
      const response = await apiRequest('POST', '/api/auth/register', { username, email, password });
      if (response.ok) {
        await fetchUser();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error registering:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout', {});
      setUser(null);
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out.',
      });
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        hasSurveyCompleted,
        setHasSurveyCompleted,
        updateUserProfile,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        fetchUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
