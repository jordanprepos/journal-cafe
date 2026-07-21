import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, RADII, SHADOWS } from "@/src/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        // A detached pill floating over the page rather than a docked bar.
        tabBarStyle: {
          position: "absolute",
          left: 20,
          right: 20,
          bottom: Math.max(insets.bottom, 16),
          height: 66,
          borderRadius: RADII.pill,
          backgroundColor: COLORS.surface,
          borderTopWidth: 0,
          // The bar is detached from the screen edge, so the default safe-area
          // bottom padding would apply on top of `bottom` and push the contents
          // out of the pill. Keep this padding tight: whatever is left after the
          // icon is the label's box, and too little clips the text.
          paddingTop: 6,
          paddingBottom: 6,
          ...SHADOWS.floating,
        },
        tabBarLabelStyle: { fontFamily: FONTS.sansSemi, fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Journal",
          tabBarIcon: ({ color }) => <Ionicons name="book" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: "Places",
          tabBarIcon: ({ color }) => <Ionicons name="location" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <Ionicons name="person" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}
