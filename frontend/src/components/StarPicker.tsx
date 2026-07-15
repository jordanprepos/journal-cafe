import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme";

interface Props {
  value: number;
  onChange: (value: number) => void;
  /** testID prefix; each star gets `${testIDPrefix}-${n}`. */
  testIDPrefix: string;
  size?: number;
}

/** Tap-to-rate 1–5 stars. Tapping the current value clears it back to 0. */
export function StarPicker({ value, onChange, testIDPrefix, size = 36 }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onChange(i === value ? 0 : i)}
          testID={`${testIDPrefix}-${i}`}
        >
          <Ionicons
            name={i <= value ? "star" : "star-outline"}
            size={size}
            color={colors.star}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, marginVertical: 4 },
});
