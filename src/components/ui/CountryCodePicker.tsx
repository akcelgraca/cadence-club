import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../lib/theme';

export interface CountryCode {
  code: string;   // e.g. "+351"
  name: string;   // e.g. "Portugal"
  flag: string;   // e.g. "🇵🇹"
}

// Most common country codes for PT/BR/EU audience
const COUNTRY_CODES: CountryCode[] = [
  { code: '+351', name: 'Portugal', flag: '🇵🇹' },
  { code: '+55', name: 'Brasil', flag: '🇧🇷' },
  { code: '+34', name: 'Espanha', flag: '🇪🇸' },
  { code: '+33', name: 'França', flag: '🇫🇷' },
  { code: '+44', name: 'Reino Unido', flag: '🇬🇧' },
  { code: '+49', name: 'Alemanha', flag: '🇩🇪' },
  { code: '+39', name: 'Itália', flag: '🇮🇹' },
  { code: '+1', name: 'EUA / Canadá', flag: '🇺🇸' },
  { code: '+81', name: 'Japão', flag: '🇯🇵' },
  { code: '+86', name: 'China', flag: '🇨🇳' },
  { code: '+91', name: 'Índia', flag: '🇮🇳' },
  { code: '+61', name: 'Austrália', flag: '🇦🇺' },
  { code: '+32', name: 'Bélgica', flag: '🇧🇪' },
  { code: '+41', name: 'Suíça', flag: '🇨🇭' },
  { code: '+31', name: 'Holanda', flag: '🇳🇱' },
  { code: '+48', name: 'Polónia', flag: '🇵🇱' },
  { code: '+353', name: 'Irlanda', flag: '🇮🇪' },
  { code: '+47', name: 'Noruega', flag: '🇳🇴' },
  { code: '+46', name: 'Suécia', flag: '🇸🇪' },
  { code: '+45', name: 'Dinamarca', flag: '🇩🇰' },
];

interface CountryCodePickerProps {
  value: string;
  onSelect: (code: string) => void;
  phoneNumber: string;
  onPhoneChange: (phone: string) => void;
  placeholder?: string;
}

export function CountryCodePicker({
  value,
  onSelect,
  phoneNumber,
  onPhoneChange,
  placeholder = 'Número de telemóvel',
}: CountryCodePickerProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === value) ?? COUNTRY_CODES[0];

  return (
    <>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.codeButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.flag}>{selectedCountry.flag}</Text>
          <Text style={styles.codeText}>{selectedCountry.code}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TextInput
          style={styles.phoneInput}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={phoneNumber}
          onChangeText={onPhoneChange}
          keyboardType="phone-pad"
        />
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Código do país</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    value === item.code && styles.countryItemActive,
                  ]}
                  onPress={() => {
                    onSelect(item.code);
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryCode}>{item.code}</Text>
                  {value === item.code && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  codeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
    minWidth: 110,
  },
  flag: {
    fontSize: 18,
  },
  codeText: {
    ...typography.body,
    fontSize: 15,
    color: colors.foreground,
  },
  phoneInput: {
    ...typography.body,
    flex: 1,
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    backgroundColor: colors.inputBackground,
    color: colors.foreground,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.headline,
    fontSize: 18,
    color: colors.foreground,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  countryItemActive: {
    backgroundColor: colors.inputBackground,
  },
  countryFlag: {
    fontSize: 22,
    width: 30,
  },
  countryName: {
    ...typography.body,
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
  },
  countryCode: {
    ...typography.body,
    fontSize: 14,
    color: colors.mutedForeground,
    fontFamily: 'DMMono_400Regular',
  },
});
