// ============================================================
// Tipos principais do Cadence Club
// ============================================================

// --- Map ---
export type MapboxStyleKey = 'dark' | 'light' | 'streets' | 'satellite' | 'outdoors';

// --- User & Profile ---
export type ActivityGoal =
  | 'stay_active'
  | 'run_weekly_km'
  | 'cycle_weekly_km'
  | 'lose_weight'
  | 'gain_muscle'
  | 'improve_endurance'
  | 'train_for_race'
  | 'train_with_friends'
  | 'improve_flexibility'
  | 'improve_technique'
  | 'explore_outdoors'
  | 'have_fun';
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type MainSport = ActivityType | 'multi';
export type SessionDuration = 'short' | 'medium' | 'long';
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'pro';

export type PreferredTime = 'morning' | 'afternoon' | 'evening' | 'flexible';
export type TrainingFocus = 'endurance' | 'speed' | 'weight_loss' | 'general_health' | 'race_prep' | 'strength' | 'flexibility' | 'technique' | 'outdoors' | 'fun';

export interface QuestionnairePreferences {
  available_days: number[];           // 0=Mon … 6=Sun
  preferred_activities: string[];     // ex: ['run', 'walk', 'cycle']
  session_duration: SessionDuration;
  fitness_level: FitnessLevel;
  weekly_frequency?: number;          // 2-7 sessions per week
  preferred_time?: PreferredTime;
  training_focus?: TrainingFocus;
}

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  bio: string;
  avatar_url: string | null;
  goal: ActivityGoal | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  // New fields
  first_name?: string;
  last_name?: string;
  city?: string;
  country?: string;
  birth_date?: string;
  gender?: Gender;
  weight_kg?: number;
  /** Máximo medido, indicado pelo utilizador. Null = estimar pela idade. */
  max_heart_rate?: number | null;
  /**
   * Idioma da app. Existe no perfil — e não só nas definições locais — porque
   * a edge function `send-push` precisa dele para traduzir o push: o sistema
   * operativo mostra o texto tal como chega e não traduz nada.
   */
  language?: 'pt' | 'en';
  height_cm?: number;
  main_sport?: MainSport;
  // Questionnaire
  available_days?: number[] | null;
  preferred_activities?: string[] | null;
  session_duration?: SessionDuration | null;
  fitness_level?: FitnessLevel | null;
  has_completed_questionnaire?: boolean;
  weekly_frequency?: number | null;
  preferred_time?: PreferredTime | null;
  training_focus?: TrainingFocus | null;
  weekly_km_target?: number | null;
}

// --- Activity ---
export type ActivityType =
  // Foot
  | 'run' | 'trail_run' | 'stroll' | 'walk' | 'wheelchair'
  // Cycling
  | 'cycle' | 'ebike' | 'mtb'
  // Strength
  | 'weight_training' | 'workout' | 'hiit' | 'crossfit' | 'physiotherapy'
  // Racquet
  | 'tennis' | 'padel' | 'squash' | 'badminton' | 'table_tennis'
  // Water
  | 'swimming' | 'surf' | 'stand_up_paddle' | 'kayak' | 'rowing' | 'canoeing' | 'sailing'
  // Winter
  | 'ice_skating' | 'snowboard' | 'alpine_skiing'
  // Team
  | 'football' | 'basketball' | 'volleyball' | 'futsal'
  // Other
  | 'yoga' | 'dance' | 'skateboard' | 'pilates';

export type ActivityCategory = 'foot' | 'cycling' | 'strength' | 'racquet' | 'water' | 'winter' | 'team' | 'other';

export interface ActivityDefinition {
  key: ActivityType;
  category: ActivityCategory;
  icon: string;
  i18n_key: string;
  description_key: string;
  distance_based: boolean;
}
export type RunType = 'road' | 'trail';
export type ActivityState = 'idle' | 'countdown' | 'recording' | 'paused' | 'finished';
export type ActivitySource = 'app' | 'healthkit' | 'healthconnect';

// --- Troços da comunidade (migração 039) ---

/** Troço percorrido numa atividade, com o meu histórico e a média do grupo. */
export interface ActivitySegment {
  segment_id: string;
  name: string;
  distance: number;
  elevation_gain: number;
  /** Tempo desta passagem, em segundos. */
  duration: number;
  pace: number | null;
  my_best: number | null;
  my_attempts: number;
  community_avg: number | null;
  community_people: number;
}

export interface SegmentDetail {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  activity_type: string;
  distance: number;
  elevation_gain: number;
  my_attempts: number;
  my_best: number | null;
  my_last: number | null;
  my_average: number | null;
  community_avg: number | null;
  community_people: number;
}

export interface SegmentEffort {
  id: string;
  activity_id: string;
  duration: number;
  pace: number | null;
  started_at: string;
}

/**
 * Uma linha do quadro de tempos de um troço.
 *
 * Só entram atividades públicas — quem tem os treinos privados não aparece, e
 * a app diz-lho em vez de o deixar a pensar que não tem tempos.
 */
export interface SegmentLeaderboardRow {
  /** Lugar. Tempos iguais partilham o mesmo — é `rank()`, não `row_number()`. */
  pos: number;
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  duration: number;
  pace: number | null;
  started_at: string;
  activity_id: string;
  is_me: boolean;
}

export interface NearbySegment {
  id: string;
  name: string;
  city: string | null;
  activity_type: string;
  distance: number;
  elevation_gain: number;
  my_attempts: number;
  people: number;
  meters_away: number;
}

export interface ActivityPhoto {
  id: string;
  activity_id: string;
  url: string;
  position: number;
  created_at?: string;
  /** Cartão de estatísticas gerado pela app (PNG transparente). */
  is_generated?: boolean;
}

export interface ActivityPoint {
  id?: string;
  activity_id: string;
  lat: number;
  lng: number;
  elevation: number | null;
  timestamp: string;
}

export interface Activity {
  id: string;
  user_id: string;
  type: ActivityType;
  state: ActivityState;
  distance: number; // metros
  duration: number; // segundos
  elevation_gain: number; // metros
  avg_pace: number; // segundos/km
  /** Batimento médio (bpm). Null quando a origem não o deu. */
  avg_heart_rate?: number | null;
  max_heart_rate?: number | null;
  start_time: string;
  end_time: string | null;
  route_summary: number[][] | null; // [[lat, lng], ...] resumido
  mood: number | null; // 1-5
  title: string | null;
  description: string | null;
  is_public: boolean;
  surface_type?: SurfaceType | null;
  equipment_id?: string | null;
  /** Capa — primeira foto da galeria, mantida por trigger na base de dados. */
  photo_url?: string | null;
  /** Galeria completa (activity_photos), quando pedida na query. */
  photos?: ActivityPhoto[];
  source: ActivitySource;
  created_at: string;
  profile?: Profile;
  kudos_count?: number;
  comments_count?: number;
  has_kudosed?: boolean;
}

// --- Social ---
export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Kudo {
  id: string;
  activity_id: string;
  user_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  activity_id: string;
  user_id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
  profile?: Profile;
}

// --- Gamification ---
export interface Streak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
}

export type BadgeCategory = 'activity' | 'distance' | 'social' | 'special' | 'multi_sport';
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  tier: BadgeTier;
  conditions: Record<string, unknown>;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  badge?: Badge;
  activity_id?: string;
}

// --- Notifications ---
export type NotificationType =
  | 'kudo' | 'comment' | 'follow' | 'streak' | 'badge'
  /** Alguém pediu para entrar num clube que administras. */
  | 'club_request'
  /** O teu pedido de adesão foi aceite. */
  | 'club_accepted'
  /** Mensagem direta. O chat de clube não notifica — ver migração 047. */
  | 'message'
  /** Evento novo num clube de que fazes parte. */
  | 'event';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  actor_id: string | null;
  reference_id: string | null;
  /**
   * Texto em português, escrito pelo gatilho. Recurso, não fonte de verdade:
   * existe para as builds anteriores à 051, que só sabem ler isto, e para as
   * linhas antigas, que não têm chave. Preferir sempre `message_key`.
   */
  message: string;
  /** Chave de tradução (`notif_kudo`, ...). NULL nas linhas anteriores à 051. */
  message_key: string | null;
  /** Parâmetros da interpolação. Conteúdo do utilizador — nomes, títulos, contagens. */
  message_params: Record<string, string | number>;
  is_read: boolean;
  created_at: string;
}

// --- Challenges (futuro) ---
export type ChallengeType = 'distance' | 'duration' | 'count' | 'elevation';

export interface Challenge {
  id: string;
  name: string;
  description: string;
  type: ChallengeType;
  /** Meta somada por toda a comunidade. Antes era adivinhado pelo nome. */
  is_collective?: boolean;
  goal: number;
  start_date: string;
  end_date: string;
  created_at?: string;
  // Devolvidos por get_challenges_with_progress
  participants: number;
  joined: boolean;
  my_progress: number;
  community_progress: number;
}

// --- Equipment ---
export type EquipmentType = 'bike' | 'shoes' | 'other';

export interface Equipment {
  id: string;
  user_id: string;
  name: string;
  type: EquipmentType;
  brand: string | null;
  model: string | null;
  notes: string | null;
  initial_distance: number;
  is_retired: boolean;
  created_at: string;
  updated_at: string;
}

// --- Stats ---
export interface WeeklyDaySummary {
  day_of_week: number; // 0=Mon, 1=Tue…6=Sun
  total_distance: number;
  total_duration: number;
  activity_count: number;
}

export interface WeeklySummary {
  total_distance: number;
  total_duration: number;
  total_elevation: number;
  activity_count: number;
}

export interface MonthlyStat {
  month_year: string;
  total_distance: number;
  total_duration: number;
  total_elevation: number;
  activity_count: number;
}

export interface ProfileStats {
  total_distance: number;
  total_duration: number;
  total_elevation: number;
  activity_count: number;
}

// --- Routes ---
export type RouteDifficulty = 'easy' | 'moderate' | 'hard' | 'expert';
export type SurfaceType = 'road' | 'trail' | 'mixed' | 'track';
export type WaypointType = 'water' | 'viewpoint' | 'restroom' | 'parking' | 'cafe' | 'landmark' | 'start' | 'finish' | 'custom';

export interface Route {
  id: string;
  user_id: string | null;
  name: string;
  description?: string;
  city: string;
  country?: string;
  activity_type: ActivityType;
  difficulty: RouteDifficulty;
  surface_type: SurfaceType;
  distance: number;
  elevation_gain: number;
  estimated_duration?: number;
  is_public: boolean;
  usage_count: number;
  rating_avg: number;
  path: [number, number][]; // decoded from PostGIS LINESTRING [lng, lat][]
  start_point: [number, number]; // [lng, lat]
  created_at: string;
  updated_at: string;
}

export interface RouteWaypoint {
  id: string;
  route_id: string;
  name: string;
  type: WaypointType;
  location: [number, number]; // [lng, lat]
  description?: string;
}

// Type for the nearby routes RPC response (includes distance_meters)
export interface NearbyRoute extends Route {
  distance_meters: number; // distance from search point
}

export interface RouteFilters {
  activity_type?: ActivityType;
  difficulty?: RouteDifficulty;
  surface_type?: SurfaceType;
  radius?: number; // meters
}

// --- Training Plan ---
export interface TrainingPlanDay {
  id?: string;
  user_id?: string;
  week_start: string;
  day_of_week: number; // 0=Mon, 6=Sun
  activity_type: ActivityType | 'rest';
  label: string;
  target_distance: number | null; // km
  target_duration: number | null; // seconds
  is_completed: boolean;
  completed_activity_id?: string | null;
  created_at?: string;
  updated_at?: string;
  // Client-side computed fields
  today?: boolean;
  actual_distance?: number; // meters from daily breakdown
  actual_duration?: number; // seconds from daily breakdown
}

// --- Settings ---
export type IntensityPreference = 'leve' | 'moderado' | 'intenso';
export type UnitSystem = 'metric' | 'imperial';
export type ActivityPrivacy = 'everyone' | 'followers' | 'only_me';
export type GpsAccuracy = 'high' | 'balanced' | 'low';
export type ThemeMode = 'dark' | 'light' | 'system';


/**
 * Interruptores do push, por tipo.
 *
 * Guardados também em `profiles.notification_prefs`, porque quem decide enviar
 * é o servidor — enquanto viveram só no telemóvel, não desligavam nada.
 * Silenciam o push, não a lista: a notificação continua a aparecer na app.
 */
export interface NotificationPreferences {
  boosts: boolean;
  comments: boolean;
  follows: boolean;
  streaks: boolean;
  badges: boolean;
  /** Pedidos de adesão e aceites, num interruptor só. */
  clubs: boolean;
  messages: boolean;
  events: boolean;
}

export interface UserSettings {
  intensity: IntensityPreference;
  unitSystem: UnitSystem;
  notifications: NotificationPreferences;
  showStats: boolean;
  autoPause: boolean;
  voiceFeedback: boolean;
  defaultActivityPrivacy: ActivityPrivacy;
  gpsAccuracy: GpsAccuracy;
  theme: ThemeMode;
  defaultMapStyle: MapboxStyleKey;
  language: 'pt' | 'en';
  weeklySummaryNotifications: boolean;
  trainingReminderNotifications: boolean;
}

// --- Clubs ---
export type ClubRole = 'admin' | 'member';

export interface Club {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  city: string | null;
  category: ActivityCategory | null;
  is_private: boolean;
  owner_id: string;
  member_count: number;
  created_at: string;
  // client-side enrichment
  is_member?: boolean;
  role?: ClubRole;
  /** Estado do meu pedido de adesão (clubes privados). */
  request_status?: 'pending' | 'accepted' | 'rejected';
}

export interface ClubChat {
  club_id: string;
  name: string;
  avatar_url: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface ClubStats {
  total_activities: number;
  total_distance: number;
  month_distance: number;
  active_members: number;
}

export interface ClubEvent {
  id: string;
  club_id: string;
  created_by: string;
  title: string;
  description: string | null;
  activity_type: string | null;
  location: string | null;
  starts_at: string;
  distance: number | null;
  created_at: string;
  // client-side enrichment
  attendee_count?: number;
  is_attending?: boolean;
  club?: Pick<Club, 'id' | 'name' | 'avatar_url'>;
}

export interface ClubJoinRequest {
  id: string;
  club_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  profile?: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url'>;
  club?: Pick<Club, 'id' | 'name'>;
}

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: ClubRole;
  joined_at: string;
  profile?: Profile;
}

export interface ClubMessage {
  id: string;
  club_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url'>;
}

// --- Messages ---
export interface Conversation {
  id: string;
  created_at: string;
  last_message_at: string | null;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
  other_user: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url' | 'city'>;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  is_read: boolean;
}

// --- Navigation ---
export type AuthScreenParams = {
  onboarding: undefined;
  login: undefined;
};

export type TabScreenParams = {
  feed: undefined;
  record: undefined;
  profile: undefined;
};
