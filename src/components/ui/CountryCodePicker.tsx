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
import { useTranslation } from 'react-i18next';

export interface CountryCode {
  code: string;      // e.g. "+351"
  i18n_key: string;  // e.g. "country_portugal"
  flag: string;      // e.g. "🇵🇹"
}

// Most common country codes for PT/BR/EU audience
const COUNTRY_CODES: CountryCode[] = [
  { code: '+351', i18n_key: 'country_portugal', flag: '🇵🇹' },
  { code: '+55', i18n_key: 'country_brazil', flag: '🇧🇷' },
  { code: '+34', i18n_key: 'country_spain', flag: '🇪🇸' },
  { code: '+33', i18n_key: 'country_france', flag: '🇫🇷' },
  { code: '+44', i18n_key: 'country_united_kingdom', flag: '🇬🇧' },
  { code: '+49', i18n_key: 'country_germany', flag: '🇩🇪' },
  { code: '+39', i18n_key: 'country_italy', flag: '🇮🇹' },
  { code: '+1', i18n_key: 'country_usa_canada', flag: '🇺🇸' },
  { code: '+81', i18n_key: 'country_japan', flag: '🇯🇵' },
  { code: '+86', i18n_key: 'country_china', flag: '🇨🇳' },
  { code: '+91', i18n_key: 'country_india', flag: '🇮🇳' },
  { code: '+61', i18n_key: 'country_australia', flag: '🇦🇺' },
  { code: '+32', i18n_key: 'country_belgium', flag: '🇧🇪' },
  { code: '+41', i18n_key: 'country_switzerland', flag: '🇨🇭' },
  { code: '+31', i18n_key: 'country_netherlands', flag: '🇳🇱' },
  { code: '+48', i18n_key: 'country_poland', flag: '🇵🇱' },
  { code: '+353', i18n_key: 'country_ireland', flag: '🇮🇪' },
  { code: '+47', i18n_key: 'country_norway', flag: '🇳🇴' },
  { code: '+46', i18n_key: 'country_sweden', flag: '🇸🇪' },
  { code: '+45', i18n_key: 'country_denmark', flag: '🇩🇰' },
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
  placeholder,
}: CountryCodePickerProps) {
  const { t } = useTranslation();
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
          placeholder={placeholder ?? t('phone_number_placeholder')}
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
              <Text style={styles.modalTitle}>{t('country_code')}</Text>
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
                  <Text style={styles.countryName}>{t(item.i18n_key as any)}</Text>
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
