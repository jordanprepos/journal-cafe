import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CafeForm } from "@/src/components/CafeForm";
import { api, Cafe, CafeInput } from "@/src/api/client";
import { useTheme } from "@/src/theme";

export default function EditCafe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setCafe(await api.getCafe(id!));
      } catch (e) {
        console.warn(e);
      }
    })();
  }, [id]);

  async function handleSave(data: CafeInput) {
    setSaving(true);
    try {
      await api.updateCafe(id!, data);
      router.replace(`/cafe/${id}`);
    } finally {
      setSaving(false);
    }
  }

  if (!cafe) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <CafeForm title="Edit café" initial={cafe} onSave={handleSave} saving={saving} />;
}
