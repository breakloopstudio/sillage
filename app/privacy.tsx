// app/privacy.tsx — Politique de confidentialité
import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../src/theme/ThemeContext';
import { LEGAL_EMAIL, LEGAL_COMPANY_NAME } from '../src/config/legal';

export default function PrivacyPage() {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn} accessibilityLabel="Retour">
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={s.title}>Politique de confidentialité</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>1. Responsable de traitement</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Le responsable du traitement des données personnelles est {LEGAL_COMPANY_NAME}, éditrice de l'application Sillage, joignable à l'adresse {LEGAL_EMAIL}. Les coordonnées complètes figurent dans les mentions légales.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>2. Données collectées</Text>
          <Text style={s.subtitle}>2.1 Création de compte</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Lors de la création d'un compte (optionnelle), nous collectons votre adresse email et un mot de passe.{'\n\n'}
            Si vous utilisez la connexion Google, nous recevons votre nom, adresse email et photo de profil associés à votre compte Google.
          </Text>
          <Text style={s.subtitle}>2.2 Utilisation de l'application</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Dans le cadre de l'utilisation des fonctionnalités, nous stockons :{'\n'}
            {'\u2022'} Vos parfums favoris (cœurs){'\n'}
            {'\u2022'} Votre parfumerie (statuts, verdicts, notes personnelles, étagères, possessions){'\n'}
            {'\u2022'} Votre parfum du jour (SOTD){'\n'}
            {'\u2022'} L'historique de vos scans{'\n'}
            {'\u2022'} Vos préférences (notifications, alertes prix)
          </Text>
          <Text style={s.subtitle}>2.3 Scan de flacons</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Lorsque vous scannez un flacon, la photo est transmise à OpenAI (GPT-4o Vision) pour identifier le parfum. Seule l'image du flacon est envoyée — aucune autre donnée personnelle. La photo n'est pas conservée par OpenAI après traitement.
          </Text>
          <Text style={s.subtitle}>2.4 Notifications push</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Si vous activez les notifications, un token de notification (Expo Push Notifications) est stocké pour vous envoyer des alertes de prix et, si vous les activez, des suggestions liées à la météo. Vous pouvez désactiver ces notifications à tout moment dans les paramètres.
          </Text>
          <Text style={s.subtitle}>2.5 Données locales</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Certaines préférences (thème, densité d'affichage, vues) et vos recherches récentes sont stockées localement sur votre appareil via AsyncStorage. Aucune donnée sensible (mot de passe, contenu de votre parfumerie) n'est conservée localement : celles-ci sont hébergées sur nos serveurs.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>3. Bases légales du traitement</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Les traitements reposent sur les bases légales suivantes :{'\n'}
            {'\u2022'} <Text style={s.bold}>Consentement</Text> : création de compte, connexion Google, scan caméra, notifications push, suggestions météo (coordonnées géographiques approximatives){'\n'}
            {'\u2022'} <Text style={s.bold}>Exécution du contrat</Text> : sauvegarde de vos favoris et de votre parfumerie{'\n'}
            {'\u2022'} <Text style={s.bold}>Intérêt légitime</Text> : préférence de thème (stockage local uniquement)
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>4. Destinataires des données</Text>
          <Text style={s.subtitle}>4.1 Hébergement et authentification (Supabase)</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            L'authentification, la base de données, le stockage des images et les fonctions serveur (« Edge Functions ») sont assurés par Supabase (base de données PostgreSQL). Les données de votre compte, de vos favoris et de votre parfumerie sont hébergées dans la région Europe de Supabase.{'\n\n'}
            Les notifications push sont acheminées par le service Expo Push Notifications (Expo / 650 Industries, États-Unis).{'\n\n'}
            Supabase et Expo appliquent des clauses contractuelles types (CCT) de la Commission européenne pour les transferts de données hors Union européenne.
          </Text>
          <Text style={s.subtitle}>4.2 OpenAI (GPT-4o Vision)</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Les photos de flacons sont transmises à OpenAI pour analyse visuelle. OpenAI ne reçoit aucune donnée d'identification personnelle. Les images envoyées ne sont pas utilisées pour entraîner les modèles d'OpenAI et sont supprimées après traitement.{'\n\n'}
            La clé API OpenAI est exclusivement stockée côté serveur (Edge Functions Supabase) et n'est jamais exposée au client.
          </Text>
          <Text style={s.subtitle}>4.3 Catalogue de parfums</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Les données des parfums (marque, nom, notes olfactives, prix) sont hébergées dans notre base de données PostgreSQL (Supabase). Les recherches sont effectuées dans notre catalogue de plus de 25 000 parfums, hébergé sur nos serveurs ; aucune donnée personnelle n'est transmise à un service tiers pour ces recherches.
          </Text>
          <Text style={s.subtitle}>4.4 Google Sign-In</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Si vous choisissez la connexion Google, un token d'authentification OAuth standard est échangé avec les serveurs Google.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>5. Transferts hors Union Européenne</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Supabase, Expo, OpenAI et Google (connexion Google) sont des sociétés américaines. Les données principales sont toutefois hébergées dans la région Europe de Supabase, et ces transferts sont encadrés par :{'\n'}
            {'\u2022'} Le Data Privacy Framework (DPF) pour Google{'\n'}
            {'\u2022'} Les clauses contractuelles types (CCT) de la Commission européenne{'\n'}
            {'\u2022'} Le stockage des données principales dans la région Europe de Supabase
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>6. Durée de conservation</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {'\u2022'} Données du compte : jusqu'à la suppression du compte{'\n'}
            {'\u2022'} Favoris et parfumerie : jusqu'à suppression manuelle ou suppression du compte{'\n'}
            {'\u2022'} Historique des scans : jusqu'à suppression manuelle ou suppression du compte{'\n'}
            {'\u2022'} Photos transmises à OpenAI : non conservées (traitement immédiat, pas de stockage){'\n'}
            {'\u2022'} Token de notification (Expo Push) : jusqu'à désactivation des notifications ou suppression du compte{'\n'}
            {'\u2022'} Préférences locales : stockées localement jusqu'à désinstallation de l'application
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>7. Vos droits (RGPD)</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :{'\n'}
            {'\u2022'} <Text style={s.bold}>Droit d'accès</Text> : obtenir une copie de vos données{'\n'}
            {'\u2022'} <Text style={s.bold}>Droit de rectification</Text> : corriger des données inexactes{'\n'}
            {'\u2022'} <Text style={s.bold}>Droit à l'effacement</Text> : demander la suppression de vos données{'\n'}
            {'\u2022'} <Text style={s.bold}>Droit à la portabilité</Text> : recevoir vos données dans un format structuré{'\n'}
            {'\u2022'} <Text style={s.bold}>Droit d'opposition</Text> : vous opposer à certains traitements{'\n'}
            {'\u2022'} <Text style={s.bold}>Droit de limitation</Text> : restreindre temporairement le traitement{'\n'}
            {'\u2022'} <Text style={s.bold}>Droit de retrait du consentement</Text> : à tout moment, sans justificatif{'\n\n'}
            Pour exercer ces droits, vous pouvez utiliser les fonctionnalités intégrées à l'application :{'\n'}
            {'\u2022'} Paramètres → Confidentialité & données → Exporter mes données{'\n'}
            {'\u2022'} Paramètres → Confidentialité & données → Supprimer mon compte{'\n\n'}
            Vous pouvez également nous contacter à l'adresse {LEGAL_EMAIL}.{'\n\n'}
            Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (cnil.fr).
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>8. Sécurité</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Nous mettons en œuvre les mesures techniques suivantes :{'\n'}
            {'\u2022'} Authentification sécurisée via Supabase Auth{'\n'}
            {'\u2022'} Règles de sécurité (Row Level Security) de la base PostgreSQL restreignant l'accès aux données de chaque utilisateur{'\n'}
            {'\u2022'} Transmission chiffrée (HTTPS) pour toutes les communications{'\n'}
            {'\u2022'} Clés API tierces exclusivement côté serveur (Edge Functions Supabase)
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>9. Cookies et stockage local</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            L'application mobile Sillage n'utilise pas de cookies. Le stockage local sur l'appareil (via AsyncStorage) se limite à vos préférences (thème, densité d'affichage, vues) et à vos recherches récentes.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>10. Mineurs</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            L'application n'est pas destinée aux personnes de moins de 15 ans. Si vous êtes parent et pensez que votre enfant nous a fourni des données personnelles, contactez-nous pour leur suppression.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>11. Modifications</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Cette politique peut être modifiée pour refléter des évolutions légales ou fonctionnelles. En cas de modification substantielle, les utilisateurs en seront informés lors de leur prochaine utilisation de l'application.
          </Text>
        </View>

        <Text style={s.version}>Dernière mise à jour : août 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    scroll: { paddingBottom: 60 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 },
    backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, color: t.colors.text },
    section: { marginBottom: 24, paddingHorizontal: 16 },
    sectionTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: t.colors.text, marginBottom: 10 },
    subtitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: t.colors.text, marginTop: 12, marginBottom: 4 },
    body: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.text, lineHeight: 22 },
    bold: { fontFamily: 'Inter_600SemiBold' },
    version: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted, marginTop: 16 },
  } as const;
}
