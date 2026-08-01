import React, { useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";

// Placeholder — mensagens diretas (fase 3 do ADR-001; Supabase Realtime).
export default function MessagesTab() {
  const [query, setQuery] = useState("");

  return (
    <View style={styles.root}>
      <View style={styles.search}>
        <Feather name="search" size={16} color="rgba(26,26,26,0.4)" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Procurar"
          placeholderTextColor="rgba(26,26,26,0.4)"
          style={styles.input}
          accessibilityLabel="Procurar conversas"
        />
      </View>
      <FlatList
        data={[]}
        renderItem={null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.title}>Sem conversas</Text>
            <Text style={styles.body}>
              Envia uma mensagem a alguém que segues.
            </Text>
          </View>
        }
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  input: {
    flex: 1,
    fontFamily: "Barlow_400Regular",
    fontSize: 14,
    color: "#1A1A1A",
  },
  container: { flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 32 },
  title: { fontFamily: "Barlow_600SemiBold", fontSize: 17, color: "#1A1A1A" },
  body: {
    fontFamily: "Barlow_400Regular",
    fontSize: 14,
    color: "rgba(26,26,26,0.55)",
    textAlign: "center",
  },
});
