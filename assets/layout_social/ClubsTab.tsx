import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

// Placeholder — ligar às tabelas `clubs` / `club_members` (ver ADR-001).
export default function ClubsTab() {
  return (
    <View style={styles.root}>
      <FlatList
        data={[]}
        renderItem={null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.title}>Ainda sem clubes</Text>
            <Text style={styles.body}>
              Junta-te a um clube perto de ti ou cria o teu.
            </Text>
          </View>
        }
        contentContainerStyle={styles.container}
      />
      <Pressable
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel="Criar clube"
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 32 },
  title: { fontFamily: "Barlow_600SemiBold", fontSize: 17, color: "#1A1A1A" },
  body: {
    fontFamily: "Barlow_400Regular",
    fontSize: 14,
    color: "rgba(26,26,26,0.55)",
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#D85A30",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
