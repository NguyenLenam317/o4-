import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Weather from "@/pages/Weather";
import Health from "@/pages/Health";
import Climate from "@/pages/Climate";
import Activities from "@/pages/Activities";
import Community from "@/pages/Community";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import { useState, useEffect } from "react";
import { UserProvider, useUser } from "./components/UserContext";
import { Navbar } from "./components/Navbar";
import { AuthGuard } from "./components/AuthGuard";

function Router() {
  const { isAuthenticated } = useUser();

  // Create protected route components
  const ProtectedWeather = () => <AuthGuard><Weather /></AuthGuard>;
  const ProtectedHealth = () => <AuthGuard><Health /></AuthGuard>;
  const ProtectedClimate = () => <AuthGuard><Climate /></AuthGuard>;
  const ProtectedActivities = () => <AuthGuard><Activities /></AuthGuard>;
  const ProtectedCommunity = () => <AuthGuard><Community /></AuthGuard>;

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={Home} />
      <Route path="/weather" component={ProtectedWeather} />
      <Route path="/health" component={ProtectedHealth} />
      <Route path="/climate" component={ProtectedClimate} />
      <Route path="/activities" component={ProtectedActivities} />
      <Route path="/community" component={ProtectedCommunity} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-1">
            <Router />
          </main>
          <Toaster />
        </div>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
