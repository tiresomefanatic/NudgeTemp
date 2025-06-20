import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import { View, Text } from "react-native";

// Import providers
import { PowerSyncProvider } from "@/lib/powersync/provider";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";

import { useColorScheme } from "@/hooks/useColorScheme";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Root layout that doesn't include the auth provider (to avoid circular dependencies)
function RootLayoutNav() {
  const { session, loading } = useAuth();
  const colorScheme = useColorScheme();

  // Show loading screen while auth state is loading
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <PowerSyncProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          {session ? (
            // Authenticated routes
            <Stack.Screen name="(tabs)/tasks" options={{ headerShown: false }} />
          ) : (
            // Unauthenticated routes
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          )}
          
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="later-stack" options={{ headerShown: false }} />
          
          <Stack.Screen name="+not-found" options={{ title: "Not Found" }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </PowerSyncProvider>
  );
}

// Root layout wraps everything with the auth provider
export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    Sharpie: require("../assets/fonts/Sharpie-Variable.ttf"),
    Kalam: require("../assets/fonts/Kalam-Variable.ttf"),
    Kihim: require("../assets/fonts/Kihim-Regular.otf"),
    Pally: require("../assets/fonts/Pally-Variable.ttf"),
    BeVietnamPro: require("../assets/fonts/BeVietnamPro-Variable.ttf"),
    SpaceGrotesk: require("../assets/fonts/SpaceGrotesk-Variable.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
