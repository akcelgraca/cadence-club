# Cadence Club

Aplicação móvel de fitness social para iOS e Android, construída com Expo e React Native.

## Funcionalidades

- **Registo de atividades** — GPS em tempo real com mapa, ritmo, distância, elevação e calorias
- **Plano de treino semanal** — gerado automaticamente com base no objetivo e preferências do utilizador
- **Feed social** — partilha atividades, dá boost e comenta nas corridas da comunidade
- **Percursos** — descobre e cria percursos no mapa, filtra por tipo de atividade
- **Perfil completo** — recordes pessoais, badges, streaks, gráficos mensais e equipamento
- **Saúde** — sincronização com Apple Health (iOS) e Health Connect (Android)
- **Notificações push** — motivação e lembretes de treino
- **Internacionalização** — Português e Inglês
- **Autenticação** — email/password, Google e Apple Sign-In

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | [Expo](https://expo.dev) SDK 57 / React Native 0.86 |
| Navegação | [Expo Router](https://expo.github.io/router) (file-based) |
| Backend | [Supabase](https://supabase.com) (auth, database, storage) |
| Estado | [Zustand](https://zustand-demo.pmnd.rs) |
| Queries | [TanStack Query](https://tanstack.com/query) |
| Mapas | [Mapbox](https://www.mapbox.com) via `@rnmapbox/maps` |
| Tipografia | Barlow + Barlow Condensed + DM Mono |
| Analytics | [PostHog](https://posthog.com) |

## Requisitos

- Node.js 20+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- Conta [Supabase](https://supabase.com)
- Conta [Mapbox](https://www.mapbox.com)
- Xcode (para iOS) ou Android Studio (para Android)

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Variáveis de ambiente

Cria um ficheiro `.env` na raiz do projeto:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_MAPBOX_TOKEN=pk.<token>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios-client-id>.apps.googleusercontent.com
EXPO_PUBLIC_POSTHOG_KEY=<posthog-key>
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### 3. Base de dados Supabase

Garante que as seguintes tabelas existem no teu projeto Supabase:

- `profiles` — dados do utilizador
- `activities` — atividades registadas
- `training_plans` — planos de treino semanais
- `routes` — percursos criados
- `equipment` — equipamento do utilizador

As políticas de RLS devem permitir que cada utilizador leia e escreva os seus próprios dados.

## Desenvolvimento

```bash
# Iniciar servidor Metro
npm start

# iOS (simulador)
npm run ios

# Android (emulador)
npm run android
```

## Build para distribuição

```bash
# Android APK para testers (sem Play Store)
eas build --platform android --profile preview

# iOS para testers (TestFlight)
eas build --platform ios --profile preview

# Produção
eas build --platform all --profile production
```

## Estrutura do projeto

```
src/
├── app/                  # Rotas (Expo Router)
│   ├── (auth)/           # Login, registo, onboarding
│   ├── (tabs)/           # Tabs principais: Hoje, Feed, Gravar, Percursos, Perfil
│   ├── activity/         # Detalhe de atividade
│   ├── profile/          # Perfil, edição, equipamento, definições
│   └── map/              # Criação de percursos
├── components/           # Componentes reutilizáveis
├── hooks/                # Custom hooks
├── services/             # Supabase, auth, atividades, mapas
├── store/                # Zustand stores
├── lib/                  # Constantes, temas, tipos, i18n
└── utils/                # Utilitários (formatação, cálculos)
```

## Autenticação Google

Para o Google Sign-In funcionar:

1. Cria um projeto na [Google Cloud Console](https://console.cloud.google.com)
2. Adiciona um cliente OAuth Web com o callback: `https://<project>.supabase.co/auth/v1/callback`
3. Adiciona um cliente OAuth iOS com o bundle ID: `com.akcelgraca.cadence`
4. No Supabase, ativa o provider Google em **Authentication → Providers**
5. Em **Authentication → URL Configuration**, adiciona `cadence://` às Redirect URLs

## Licença

Privado — todos os direitos reservados.
