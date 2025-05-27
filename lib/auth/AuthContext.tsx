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
  scheme: "nudge", // Use hardcoded scheme name
});

// Initialize WebBrowser for OAuth redirects
WebBrowser.maybeCompleteAuthSession();

// Define the AuthContext type
type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithPhone: (phone: string) => Promise<{ error: Error | null }>;
  verifyOtp: (
    phone: string,
    token: string
  ) => Promise<{ error: Error | null; data: { session: Session | null } }>;
  updateUserPhone: (phone: string) => Promise<{ error: Error | null }>;
  updateUserName: (name: string) => Promise<{ error: Error | null }>;
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

  // Create a user record in the database
  const createUserInDatabase = async (user: User) => {
    try {
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("id")
        .eq("phone", user.phone) // Changed from email to phone
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        // PGRST116 is "not found"
        console.error("Error checking if user exists:", checkError);
        return;
      }

      // If user doesn't exist, create them
      if (!existingUser) {
        const { error } = await supabase.from("users").insert({
          phone: user.phone, // Changed from email to phone
          first_name: user.user_metadata?.full_name
            ? user.user_metadata.full_name.split(" ")[0]
            : null,
          last_name: user.user_metadata?.full_name
            ? user.user_metadata.full_name.split(" ").slice(1).join(" ")
            : null,
        });

        if (error) {
          console.error("Error creating user in database:", error);
        } else {
          console.log("User created in database successfully");
        }
      }
    } catch (error) {
      console.error("Error in createUserInDatabase:", error);
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Create user in database if they exist in auth but not in the database
      if (session?.user) {
        createUserInDatabase(session.user);
      }
      
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("Auth state changed:", _event);
      setSession(session);
      setUser(session?.user ?? null);
      
      // Create user in database on sign-up or sign-in
      if (_event === 'SIGNED_IN' && session?.user) {
        await createUserInDatabase(session.user);
      }
    });

    // Listen for deep links while the app is open
    const linkingSubscription = Linking.addEventListener("url", handleDeepLink);

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  // Sign out
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      // Redirect to auth flow
      router.replace("/(auth)");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  // Sign in with phone
  const signInWithPhone = async (phone: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });
      return { error };
    } catch (error) {
      console.error("Phone sign in error:", error);
      return { error: error as Error };
    }
  };

  // Verify OTP
  const verifyOtp = async (phone: string, token: string) => {
    try {
      const {
        data,
        error,
      } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });

      if (!error && data.session) {
         if (data.user) {
          await createUserInDatabase(data.user); // Create user if not exists
        }
        router.replace("/(auth)/enter-name"); // Navigate to enter name screen
      }
      return { data: { session: data.session }, error };
    } catch (error) {
      console.error("Verify OTP error:", error);
      return { data: { session: null }, error: error as Error };
    }
  };

  // Update user phone
  const updateUserPhone = async (phone: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ phone });
      return { error };
    } catch (error) {
      console.error("Update phone error:", error);
      return { error: error as Error };
    }
  };

  // Update user name
  const updateUserName = async (name: string) => {
    try {
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      // Get current user via session, then user object from session
      const sessionResult = await supabase.auth.getSession();
      const currentAuthUser = sessionResult?.data?.session?.user;

      if (!currentAuthUser || !currentAuthUser.phone) {
        console.error("Error: Current auth user or phone number is not available for updating name.");
        return { error: new Error("User phone number not found for updating name.") };
      }

      // Update in auth.users table (user_metadata.full_name)
      const { data: updatedAuthData, error: authError } = await supabase.auth.updateUser({
        data: { full_name: name },
      });

      if (authError) {
        console.error("Error updating user name in auth:", authError);
        return { error: authError };
      }

      // Update in public.users table
      const { error: dbError } = await supabase
        .from('users')
        .update({ first_name: firstName, last_name: lastName, updated_at: new Date().toISOString() })
        .eq('phone', currentAuthUser.phone); 

      if (dbError) {
        console.error("Error updating user name in public.users table:", dbError);
        return { error: dbError }; 
      }
      
      const newAuthenticatedUser = updatedAuthData?.user; 

      if (newAuthenticatedUser) {
        setUser({
            ...newAuthenticatedUser, 
            user_metadata: {
                ...(newAuthenticatedUser.user_metadata || {}),
                full_name: name, 
            }
        });
      } else if (user) {
        setUser({
          ...user,
          user_metadata: {
            ...(user.user_metadata || {}),
            full_name: name,
          },
        });
      } else {
         setUser({
            ...currentAuthUser, 
            user_metadata: {
                ...(currentAuthUser.user_metadata || {}),
                full_name: name,
            }
        });
      }
      
      router.replace("/(tabs)/tasks");
      return { error: null };
    } catch (error) {
      console.error("General error in updateUserName:", error);
      return { error: error as Error };
    }
  };

  const value = {
    session,
    user,
    loading,
    signOut,
    signInWithPhone,
    verifyOtp,
    updateUserPhone,
    updateUserName,
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
