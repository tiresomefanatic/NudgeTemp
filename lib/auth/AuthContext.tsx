import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import { Platform } from "react-native";

// URL for handling OAuth redirects
const redirectTo = makeRedirectUri({
  scheme: Constants.manifest?.scheme || "nudge",
});

// Initialize WebBrowser for OAuth redirects
WebBrowser.maybeCompleteAuthSession();

// Define the AuthContext type
type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null; data: { user: User | null } }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
};

// Create the AuthContext
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the AuthProvider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Handle deep links for OAuth redirects
  const handleDeepLink = ({ url }: { url: string }) => {
    if (url) {
      const parsedURL = Linking.parse(url);
      const { queryParams } = parsedURL;

      // Handle deep link for OAuth providers
      if (queryParams?.access_token && queryParams?.refresh_token) {
        const { access_token, refresh_token } = queryParams;
        supabase.auth.setSession({
          access_token: access_token as string,
          refresh_token: refresh_token as string,
        });
      }
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth state changed:", _event);
      setSession(session);
      setUser(session?.user ?? null);
    });

    // Listen for deep links while the app is open
    const linkingSubscription = Linking.addEventListener("url", handleDeepLink);

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) {
        // Navigate to the tabs (authenticated part of the app)
        router.replace({ pathname: "/" }); // This will be handled by the root navigation to go to tabs
      }

      return { error };
    } catch (error) {
      console.error("Sign in error:", error);
      return { error: error as Error };
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: "nudge://confirm-email",
        },
      });

      if (!error) {
        // Navigate to confirmation screen
        router.navigate({ pathname: "confirm-email" });
      }

      return { data, error: error as Error | null };
    } catch (error) {
      console.error("Sign up error:", error);
      return { data: { user: null }, error: error as Error };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      // Navigate back to the login screen
      router.replace({ pathname: "/" });
      // The root navigation will handle redirecting to login when no session exists
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "nudge://reset-password",
      });
      return { error };
    } catch (error) {
      console.error("Reset password error:", error);
      return { error: error as Error };
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      // Open browser for authentication
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo
        );

        if (result.type === "success") {
          // Parse URL and extract tokens
          const { url } = result;
          const parsedUrl = Linking.parse(url);

          if (parsedUrl.queryParams) {
            // If using v2 OAuth flow (with access_token and refresh_token in URL)
            const { access_token, refresh_token } = parsedUrl.queryParams;
            if (access_token && refresh_token) {
              await supabase.auth.setSession({
                access_token: access_token as string,
                refresh_token: refresh_token as string,
              });
            }
          }
        }
      }

      return { error: null };
    } catch (error) {
      console.error("Error signing in with Google:", error);
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  // Sign in with Apple
  const signInWithApple = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      // Open browser for authentication
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo
        );

        if (result.type === "success") {
          // Parse URL and extract tokens
          const { url } = result;
          const parsedUrl = Linking.parse(url);

          if (parsedUrl.queryParams) {
            // If using v2 OAuth flow (with access_token and refresh_token in URL)
            const { access_token, refresh_token } = parsedUrl.queryParams;
            if (access_token && refresh_token) {
              await supabase.auth.setSession({
                access_token: access_token as string,
                refresh_token: refresh_token as string,
              });
            }
          }
        }
      }

      return { error: null };
    } catch (error) {
      console.error("Error signing in with Apple:", error);
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    signInWithGoogle,
    signInWithApple,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Create a hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
