# Registre des traitements — Sillage

Document interne conforme à l'article 30 du RGPD.

| Traitement | Finalité | Base légale | Sous-traitant(s) | Durée de conservation |
|---|---|---|---|---|
| Création de compte (email / Google) | Authentification | Consentement (art. 6.1.a) | Firebase Auth (Google LLC) | Jusqu'à suppression du compte |
| Formulaires de connexion / inscription | Accès au service | Consentement | Firebase Auth | Jusqu'à suppression du compte |
| Favoris (parfums likés) | Sauvegarde des préférences utilisateur | Exécution du contrat (art. 6.1.b) | Cloud Firestore | Jusqu'à suppression manuelle ou du compte |
| Parfumerie (wardrobe, étagères, notes) | Gestion de la collection personnelle | Exécution du contrat | Cloud Firestore | Jusqu'à suppression manuelle ou du compte |
| Collection / ScentList | Gestion de liste d'envies | Exécution du contrat | Cloud Firestore | Jusqu'à suppression manuelle ou du compte |
| Parfum du jour (SOTD) | Service de suggestion météo | Exécution du contrat | Cloud Firestore | Jusqu'à suppression du compte |
| Historique des scans | Journal des identifications de parfums | Exécution du contrat | Cloud Firestore | Jusqu'à suppression manuelle ou du compte |
| Scan photo → GPT-4o Vision | Identification de flacon par IA | Consentement (capture photo) | OpenAI (GPT-4o, clé API serveur uniquement) | Photo non conservée par OpenAI |
| Recherche vocale on-device | Saisie vocale de recherche | Consentement (micro) | Apple/Google (Speech API on-device) | Traitement local, pas de stockage |
| Recherche vocale fallback Whisper | Saisie vocale de rechange | Consentement (micro) | OpenAI (Whisper-1, Cloud Function) | Fichier audio non conservé |
| Notifications push (prix, météo) | Alertes personnalisées | Consentement (notifications OS + in-app) | Firebase Cloud Messaging (Google LLC) | Token : jusqu'à désactivation ou suppression du compte |
| Suggestions météo | Suggestifier un parfum adapté | Consentement | Cloud Firestore (coordonnées), Open-Meteo (gratuit, sans clé) | Coordonnées : jusqu'à désactivation météo ou suppression du compte |
| Alertes prix | Surveillance des baisses de prix | Exécution du contrat | Cloud Functions (checkPriceAlerts planifiée) | Jusqu'à désactivation ou suppression du compte |
| Préférences thème (clair/sombre) | Personnalisation de l'interface | Intérêt légitime (stockage local uniquement) | Aucun (AsyncStorage local) | Jusqu'à désinstallation |
| Logs d'export RGPD | Audit de la fonctionnalité d'export | Obligation légale (art. 5.2, accountability) | Cloud Functions (log stdout) | Logs Firebase : rétention Cloud Logging standard (30 j par défaut) |
| Logs de suppression de compte | Audit RGPD — effacement | Obligation légale | Cloud Functions (log stdout : uid + timestamp, sans données personnelles) | Logs Firebase : rétention Cloud Logging standard (30 j par défaut) |

**Mesures de sécurité** :
- Authentification obligatoire pour l'accès aux données personnelles
- Règles Firestore : données accessibles uniquement par leur propriétaire
- Clés API tierces exclusivement côté serveur (Cloud Functions)
- Communications chiffrées en transit (HTTPS/TLS)
- Token FCM gérés côté serveur uniquement

**Droits des personnes** :
- Accessibles en self-service dans l'application : Paramètres → Confidentialité & données
- Export JSON structuré (droit à la portabilité)
- Suppression complète du compte (droit à l'effacement)
- Révoquation granulaire des consentements
- Contact : cf. mentions légales (LEGAL_EMAIL)

**DPO** : Non requis (structure de taille modérée — cf. art. 37 RGPD et décret n°2019-536).
