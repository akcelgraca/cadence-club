import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import i18n from '../lib/i18n';
import type { Profile, ActivityGoal } from '../lib/types';

/**
 * O idioma da pessoa, para tudo o que é desenhado fora da app.
 *
 * Os templates do Supabase são um só por tipo de mensagem — não há forma de ter
 * um em português e outro em inglês. O que há é o `user_metadata`, que o
 * template consegue ler: guardando aqui o idioma, o template escolhe o ramo
 * certo (ver `supabase/email-templates/`). Sem isto, quem usa a app em inglês
 * recebia a confirmação de conta em português.
 */
function idiomaDosEmails(): 'pt' | 'en' {
  return i18n.language?.startsWith('en') ? 'en' : 'pt';
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { lang: idiomaDosEmails() } },
  });
  if (error) throw error;
  return data;
}

/**
 * Acompanha a mudança de idioma nas Definições.
 *
 * O `lang` é escrito no registo e nunca mais mexido — quem se registasse em
 * português e passasse a app para inglês continuaria a receber os emails de
 * recuperação de palavra-passe em português. Falha em silêncio de propósito:
 * mudar o idioma da app não pode ficar dependente da rede.
 */
export async function syncLanguagePreference(idioma?: 'pt' | 'en') {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    // O idioma vem por parâmetro porque o `i18n` só muda no efeito seguinte à
    // escolha: lido aqui, seria ainda o anterior.
    const escolhido = idioma ?? idiomaDosEmails();

    // Dois sítios, dois consumidores diferentes: o `user_metadata` é o que os
    // templates de email do Supabase conseguem ler, e o `profiles.language` é
    // o que a edge function das notificações lê. Nenhum dos dois consegue ver
    // o outro.
    await Promise.all([
      supabase.auth.updateUser({ data: { lang: escolhido } }),
      supabase.from('profiles').update({ language: escolhido }).eq('id', data.session.user.id),
    ]);
  } catch {
    // sem rede, ou sessão expirada — fica para a próxima mudança
  }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

export async function createProfile(profile: {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  goal?: ActivityGoal;
  first_name?: string;
  last_name?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
  weight_kg?: number;
  height_cm?: number;
  available_days?: number[];
  preferred_activities?: string[];
  session_duration?: string;
  fitness_level?: string;
  weekly_frequency?: number;
  preferred_time?: string;
  training_focus?: string;
  has_completed_questionnaire?: boolean;
  weekly_km_target?: number | null;
}) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      ...profile,
      is_public: true,
      // O idioma fica no perfil porque o servidor precisa dele: a edge function
      // `send-push` traduz o push, e o sistema operativo mostra o texto tal
      // como chega. Ver a migração 051.
      language: idiomaDosEmails(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadAvatar(userId: string, uri: string, mimeType?: string): Promise<string> {
  // React Native's fetch().blob() defaults to text/plain for local files,
  // so we fix the MIME type via blob.slice() which accepts a contentType arg.
  const response = await fetch(uri);
  const blob = await response.blob();
  const fixedBlob = blob.slice(0, blob.size, mimeType || 'image/jpeg');

  const ext = mimeType ? mimeType.split('/')[1] : 'jpg';
  const filePath = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(filePath, fixedBlob);
  if (error) throw error;

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return urlData.publicUrl;
}

// ---- Social Sign-In ----

// No-op kept for backwards compatibility with _layout.tsx import
export function configureGoogleSignIn() {}

export async function signInWithGoogle() {
  const redirectUri = makeRedirectUri({ scheme: 'cadence' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUri,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('Falha ao obter URL de autenticação Google');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

  if (result.type !== 'success') {
    throw new Error('Autenticação cancelada');
  }

  // Supabase returns tokens in the URL hash after OAuth redirect
  const hash = result.url.split('#')[1] ?? '';
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token') ?? '';

  if (!access_token) throw new Error('Falha ao obter tokens de autenticação');

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (sessionError) throw sessionError;
  return sessionData;
}

export async function signInWithApple() {
  if (Platform.OS !== 'ios') throw new Error('Apple Sign-In apenas disponível em iOS');

  // Guard against free developer accounts that don't support Sign In with Apple
  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Apple Sign-In não está disponível neste dispositivo. Contas gratuitas de developer não suportam esta funcionalidade.');
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
    });

    if (!credential.identityToken) throw new Error('Falha ao obter token Apple');

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw error;
    return data;
  } catch (err: any) {
    // User cancelled or Apple Sign-In failed
    if (err?.code === 'ERR_CANCELED' || err?.code === 'ERR_APPLE_AUTHENTICATION') {
      throw new Error('Autenticação Apple cancelada ou indisponível.');
    }
    throw err;
  }
}
