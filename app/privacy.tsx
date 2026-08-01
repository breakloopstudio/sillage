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
            {'\u2022'} Vos parfums favoris{'\n'}
            {'\u2022'} Votre collection et wishlist{'\n'}
            {'\u2022'} Votre parfumerie (états de possession, notes personnelles, étagères){'\n'}
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
            Si vous activez les notifications, un token FCM (Firebase Cloud Messaging) est stocké pour vous envoyer des alertes de prix. Vous pouvez désactiver cette fonction à tout moment dans les paramètres.
          </Text>
          <Text style={s.subtitle}>2.5 Données locales</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Votre préférence de thème (clair/sombre/système) est stockée localement sur votre appareil via AsyncStorage. Aucune autre donnée n'est conservée localement.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>3. Bases légales du traitement</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Les traitements reposent sur les bases légales suivantes :{'\n'}
            {'\u2022'} <Text style={s.bold}>Consentement</Text> : création de compte, connexion Google, scan caméra, notifications push, suggestions météo (coordonnées géographiques approximatives){'\n'}
            {'\u2022'} <Text style={s.bold}>Exécution du contrat</Text> : sauvegarde de vos favoris, collection, wishlist, parfumerie{'\n'}
            {'\u2022'} <Text style={s.bold}>Intérêt légitime</Text> : préférence de thème (stockage local uniquement)
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>4. Destinataires des données</Text>
          <Text style={s.subtitle}>4.1 Services Firebase (Google)</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Firebase Auth, Firestore, Cloud Functions, Cloud Storage et Cloud Messaging sont utilisés pour l'authentification, le stockage et les notifications. Ces services sont fournis par Google LLC (États-Unis). Les serveurs Firestore et Cloud Functions sont configurés dans la région europe-west1 (Belgique).{'\n\n'}
            Google est certifié sous le Data Privacy Framework (successeur du Privacy Shield) et applique des clauses contractuelles types pour les transferts hors UE.
          </Text>
          <Text style={s.subtitle}>4.2 OpenAI (GPT-4o Vision)</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Les photos de flacons sont transmises à OpenAI pour analyse visuelle. OpenAI ne reçoit aucune donnée d'identification personnelle. Les images envoyées ne sont pas utilisées pour entraîner les modèles d'OpenAI et sont supprimées après traitement.{'\n\n'}
            La clé API OpenAI est exclusivement stockée côté serveur (Cloud Functions) et n'est jamais exposée au client.
          </Text>
          <Text style={s.subtitle}>4.3 Catalogue de parfums</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Les données des parfums (marque, nom, notes olfactives, prix) sont hébergées dans notre base de données interne (Firestore). Aucune donnée personnelle n'est transmise à un service tiers pour les recherches de parfums.{"\n\n"}
            Les recherches sont effectuées localement dans notre catalogue de 21 000+ parfums.
          </Text>
          <Text style={s.subtitle}>4.4 Google Sign-In</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Si vous choisissez la connexion Google, un token d'authentification OAuth standard est échangé avec les serveurs Google.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>5. Transferts hors Union Européenne</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Les services Firebase et OpenAI sont hébergés par des sociétés américaines. Ces transferts sont encadrés par :{'\n'}
            {'\u2022'} Le Data Privacy Framework (DPF) pour Google{'\n'}
            {'\u2022'} Les clauses contractuelles types (CCT) de la Commission européenne{'\n'}
            {'\u2022'} Le stockage des données principales dans la région europe-west1
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>6. Durée de conservation</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {'\u2022'} Données du compte : jusqu'à la suppression du compte{'\n'}
            {'\u2022'} Favoris, collection, wishlist, parfumerie : jusqu'à suppression manuelle ou suppression du compte{'\n'}
            {'\u2022'} Historique des scans : jusqu'à suppression manuelle ou suppression du compte{'\n'}
            {'\u2022'} Photos transmises à OpenAI : non conservées (traitement immédiat, pas de stockage){'\n'}
            {'\u2022'} Token FCM : jusqu'à désactivation des notifications ou suppression du compte{'\n'}
            {'\u2022'} Préférence de thème : stockée localement jusqu'à désinstallation de l'application
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
            {'\u2022'} Authentification sécurisée via Firebase Auth{'\n'}
            {'\u2022'} Règles Firestore restreignant l'accès aux données de chaque utilisateur{'\n'}
            {'\u2022'} Transmission chiffrée (HTTPS) pour toutes les communications{'\n'}
            {'\u2022'} Clés API tierces exclusivement côté serveur (Cloud Functions)
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>9. Cookies et stockage local</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            L'application mobile Sillage n'utilise pas de cookies. Le seul stockage local sur l'appareil concerne la préférence de thème (clair/sombre/système) via AsyncStorage.
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

        <Text style={s.version}>Dernière mise à jour : juillet 2026</Text>
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
