# Guide d'Installation et Déploiement - VISIT TRACKER

Ce document explique comment déployer une nouvelle instance de l'application **VISIT TRACKER** pour une nouvelle entreprise cliente.

---

## 🛠️ Prérequis

1.  Un compte **Supabase** (gratuit ou payant) pour la base de données et l'authentification.
2.  Un compte d'hébergement frontend comme **Vercel**, **Netlify**, ou un serveur web classique.
3.  Le package de déploiement `visit-tracker-release.zip`.

---

## 1. Configuration de la Base de Données (Supabase)

1.  Créez un nouveau projet sur [Supabase](https://supabase.com).
2.  Allez dans l'onglet **SQL Editor** de votre console Supabase.
3.  Exécutez dans l'ordre les fichiers SQL situés dans le dossier `supabase/migrations/` du package :
    *   `20260613212728_001_initial_schema.sql` (Schéma et tables de base)
    *   `20260615145000_003_billing_and_items.sql` (Prestations et facturation)
    *   `20260615201500_005_enterprise_redesign.sql` (Redesign entreprise)
    *   `20260616120000_fix_rls_recursion.sql` (Sécurité RLS)
    *   `20260619224500_medical_and_hr_presences.sql` (Infirmerie & RH)
    *   `20260622120000_production_cleanup_and_rls.sql` (Sécurité RLS)
    *   `20260629124500_agenda_control_tower.sql` (Agenda unifié)
    *   `20260702153500_assistant_privileges.sql` (Droits de l'assistante)
    *   `20260702174000_company_settings.sql` (Configuration entreprise)
4.  Récupérez les clés API de votre projet Supabase dans **Project Settings** > **API** :
    *   `Project URL` (Ex: `https://xxxx.supabase.co`)
    *   `API Key` (clé `anon` / `public`)

---

## 2. Déploiement du Frontend

1.  Décompressez le package de déploiement `visit-tracker-release.zip` sur votre machine ou liez le dossier à un dépôt Git privé (GitHub/GitLab).
2.  Créez un fichier `.env` à la racine en copiant le fichier `.env.example` :
    ```env
    VITE_SUPABASE_URL=https://votre-projet.supabase.co
    VITE_SUPABASE_ANON_KEY=votre-cle-anon-publique-supabase
    ```
3.  Installez les dépendances et lancez le build de production :
    ```bash
    npm install
    npm run build
    ```
4.  Déployez le dossier `dist/` généré sur votre hébergeur (Vercel, Netlify, Hostinger, etc.).
    *   *Si vous utilisez Vercel*, importez simplement le projet Git, configurez les variables d'environnement `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans la console Vercel, et laissez Vercel lancer le build automatiquement.

---

## 3. Configuration Initiale de l'Entreprise

1.  Ouvrez l'application déployée dans votre navigateur.
2.  Accédez à l'écran de création du compte administrateur racine à l'adresse suivante :
    `https://votre-domaine.com/setup`
3.  Remplissez le formulaire pour créer le premier compte **Administrateur** de l'entreprise.
4.  Une fois connecté, allez dans le menu **Paramètres** (accessible uniquement aux profils Admin et Direction).
5.  Dans l'onglet **Paramètres Généraux**, personnalisez l'application :
    *   **Nom de l'entreprise** (Mettra à jour la page de connexion, le menu latéral, etc.)
    *   **Slogan**
    *   **Numéro RCCM & IFU** (Pour les en-têtes officiels de factures)
    *   **Téléphone / Email de contact / Adresse physique**
    *   **URL du Logo** (URL de l'image de votre logo)
    *   **Préfixes de code de visite et de facturation** (Ex: VT, FAC)
6.  Enregistrez. L'application est maintenant configurée et prête à être utilisée par tout le personnel de cette entreprise !
