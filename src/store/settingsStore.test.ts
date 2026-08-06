import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from './settingsStore';

const SETTINGS_KEY = 'user-settings';

/** Estado de origem da store, para repor entre testes. */
const estadoInicial = useSettingsStore.getState();
const DEFAULTS = estadoInicial.settings;

beforeEach(async () => {
  await AsyncStorage.clear();
  useSettingsStore.setState(estadoInicial, true);
});

/** Lê o que está gravado no telemóvel. */
async function gravado() {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('estado inicial', () => {
  it('arranca em métrico, público e a carregar', () => {
    expect(DEFAULTS.unitSystem).toBe('metric');
    expect(DEFAULTS.defaultActivityPrivacy).toBe('everyone');
    expect(estadoInicial.isLoading).toBe(true);
  });
});

describe('loadSettings', () => {
  it('mantém as predefinições quando nunca se gravou nada', async () => {
    await useSettingsStore.getState().loadSettings();

    const { settings, isLoading } = useSettingsStore.getState();
    expect(settings).toEqual(DEFAULTS);
    expect(isLoading).toBe(false);
  });

  it('aplica o que estava gravado por cima das predefinições', async () => {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ unitSystem: 'imperial' }));

    await useSettingsStore.getState().loadSettings();

    const { settings } = useSettingsStore.getState();
    expect(settings.unitSystem).toBe('imperial');
    // O resto continua na predefinição — não fica undefined.
    expect(settings.autoPause).toBe(DEFAULTS.autoPause);
    expect(settings.language).toBe(DEFAULTS.language);
  });

  it('preenche as notificações em falta em vez de as perder', async () => {
    // Uma versão antiga da app pode ter gravado só parte das notificações;
    // sem a fusão profunda, `notifications.badges` vinha undefined.
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ notifications: { boosts: false } }),
    );

    await useSettingsStore.getState().loadSettings();

    expect(useSettingsStore.getState().settings.notifications).toEqual({
      ...DEFAULTS.notifications,
      boosts: false,
    });
  });

  it('não deixa a app presa a carregar quando o que está gravado está corrompido', async () => {
    await AsyncStorage.setItem(SETTINGS_KEY, '{ isto não é json');

    await useSettingsStore.getState().loadSettings();

    const { settings, isLoading } = useSettingsStore.getState();
    expect(isLoading).toBe(false);
    expect(settings).toEqual(DEFAULTS);
  });
});

describe('updateSettings', () => {
  it('altera só o que foi pedido e grava tudo', async () => {
    await useSettingsStore.getState().updateSettings({ unitSystem: 'imperial' });

    const { settings } = useSettingsStore.getState();
    expect(settings.unitSystem).toBe('imperial');
    expect(settings.theme).toBe(DEFAULTS.theme);
    expect(await gravado()).toEqual(settings);
  });

  it('funde as notificações em vez de as substituir', async () => {
    await useSettingsStore.getState().updateSettings({
      notifications: { comments: false } as any,
    });

    expect(useSettingsStore.getState().settings.notifications).toEqual({
      ...DEFAULTS.notifications,
      comments: false,
    });
  });

  it('acumula alterações sucessivas', async () => {
    await useSettingsStore.getState().updateSettings({ unitSystem: 'imperial' });
    await useSettingsStore.getState().updateSettings({ language: 'en' });

    const { settings } = useSettingsStore.getState();
    expect(settings.unitSystem).toBe('imperial');
    expect(settings.language).toBe('en');
    expect(await gravado()).toEqual(settings);
  });

  it('sobrevive a um reinício da app', async () => {
    await useSettingsStore.getState().updateSettings({ unitSystem: 'imperial', autoPause: false });

    // Reinício: a store volta ao estado de origem e volta a ler do disco.
    useSettingsStore.setState(estadoInicial, true);
    await useSettingsStore.getState().loadSettings();

    const { settings } = useSettingsStore.getState();
    expect(settings.unitSystem).toBe('imperial');
    expect(settings.autoPause).toBe(false);
  });
});

describe('resetSettings', () => {
  it('repõe as predefinições e limpa o que estava gravado', async () => {
    await useSettingsStore.getState().updateSettings({ unitSystem: 'imperial' });

    await useSettingsStore.getState().resetSettings();

    expect(useSettingsStore.getState().settings).toEqual(DEFAULTS);
    expect(await gravado()).toBeNull();
  });
});
