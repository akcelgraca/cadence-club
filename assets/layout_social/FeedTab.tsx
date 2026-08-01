import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

// Placeholder — substituir pelo feed real (TanStack Query sobre `activities`).
// Nota do gesto: dentro dos posts usa imagens estáticas do Mapbox (Static Images
// API), não MapView interativo — um mapa interativo rouba o swipe do pager.
export default function FeedTab() {
  return (
    <FlatList
      data={[]}
      renderItem={null}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.title}>Ainda sem atividades</Text>
          <Text style={styles.body}>
            Segue outros corredores ou entra num clube para veres corridas
            aqui.
          </Text>
        </View>
      }
      contentContainerStyle={styles.container}
    />
  );
}

const styles = StyleSheet.create({
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
