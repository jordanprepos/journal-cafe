import { useState } from "react";
import { CafeForm } from "@/src/components/CafeForm";
import { useRouter } from "expo-router";
import { api, CafeInput } from "@/src/api/client";

export default function NewCafe() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSave(data: CafeInput) {
    setSaving(true);
    try {
      const created = await api.createCafe(data);
      router.replace(`/cafe/${created.id}`);
    } finally {
      setSaving(false);
    }
  }

  return <CafeForm title="New café" onSave={handleSave} saving={saving} />;
}
