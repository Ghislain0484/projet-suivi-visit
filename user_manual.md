# GICO VISIT TRACKER - MANUEL D'UTILISATION (V1.2)

Bienvenue dans le manuel d'utilisation officiel de l'application **GICO VISIT TRACKER**. Ce guide a pour but d'aider les utilisateurs finaux à naviguer et à utiliser efficacement le système de suivi des visites, de pointage RH et de gestion médicale interne.

---

## TABLE DES MATIÈRES
1. [RÔLES ET DROITS D'ACCÈS](#1-rôles-et-droits-daccès)
2. [MODULE DE RÉCEPTION (Accueil des Visiteurs)](#2-module-de-réception-accueil-des-visiteurs)
3. [ESPACE COLLABORATEUR (Entretien & Rapport)](#3-espace-collaborateur-entretien-rapport)
4. [MODULE DE FACTURATION & CAISSE (Comptabilité)](#4-module-de-facturation-caisse-comptabilité)
5. [MODULE INFIRMERIE (Espace Santé & Soins)](#5-module-infirmerie-espace-santé-soins)
6. [ESPACE RH & POINTAGE (Présence & Déplacements)](#6-espace-rh-pointage-présence-déplacements)
7. [ADMINISTRATION ET RÉGLAGES (Configuration)](#7-administration-et-réglages-configuration)

---

## 1. RÔLES ET DROITS D'ACCÈS

Le système est configuré avec 8 rôles utilisateurs distincts pour assurer la sécurité et la confidentialité des informations :

| Rôle | Description | Droits Clés |
| :--- | :--- | :--- |
| **Administrateur** | Gérant technique du système | Gestion des comptes, configuration des services, audits. |
| **Directeur Général** | Direction de l'entreprise | Visualisation globale (stats, rapports), validations RH. |
| **Assistante de Direction (Réception)** | Hôtesse d'accueil, secrétariat | Enregistrement des visites, gestion de l'agenda d'accueil. |
| **Responsable Service** | Manager d'un département | Planification de missions, suivi des indicateurs de son service. |
| **Comptable** | Pôle financier | Analyse de facturation, configuration des tarifs de prestations. |
| **Caissier(ère)** | Caisse physique | Enregistrement des paiements réels, impression des reçus. |
| **Collaborateur** | Employé standard | Pointage GPS, rédaction de rapports de visite, carnet de santé. |
| **Infirmier** | Professionnel de santé | Accès complet aux dossiers médicaux, pharmacie, arrêts maladie. |

---

## 2. MODULE DE RÉCEPTION (Accueil des Visiteurs)

L'Assistante de Direction ou le Secrétaire d'accueil est la première ligne d'utilisation de l'application.

### A. Enregistrer l'arrivée d'un visiteur
1. Rendez-vous dans le menu **"Visites"** puis cliquez sur **"Nouvelle visite"** (ou via le raccourci du tableau de bord).
2. **Recherche de visiteur existant** : Pour gagner du temps, cliquez sur *"Sélectionner un visiteur existant"*. Si le visiteur est déjà venu, sélectionnez-le dans la liste. Sinon, saisissez manuellement ses informations (Prénom, Nom, Téléphone, Entreprise).
3. **Détails de la visite** :
   - Sélectionnez le **Service concerné** par la visite.
   - Saisissez le **Motif exact** de la visite.
   - Sélectionnez le **Collaborateur à rencontrer** dans la liste déroulante des employés de l'entreprise.
   - Précisez si le visiteur a un *Rendez-vous prévu*.
4. Cliquez sur **"Enregistrer la visite"**. Le collaborateur désigné reçoit instantanément une notification visuelle et sonore dans son interface.

### B. Enregistrer le départ d'un visiteur
Lorsqu'un visiteur quitte l'établissement :
1. Dans le registre des visites, recherchez le code visite (ex: `VST-20260622-00001`).
2. Cliquez sur la visite pour ouvrir la fiche détaillée.
3. Cliquez sur le bouton vert **"Enregistrer le départ"**. L'heure de départ est enregistrée, clôturant ainsi le temps de présence dans l'établissement.

---

## 3. ESPACE COLLABORATEUR (Entretien & Rapport)

Le collaborateur utilise principalement l'application pour gérer les visites qui lui sont attribuées et soumettre des rapports d'activité.

### A. Notification de visite
Dès qu'un visiteur vous est attribué à l'accueil :
1. Une pastille rouge apparaît sur l'icône de la cloche 🔔 dans le coin supérieur droit.
2. Cliquez sur la notification pour ouvrir directement la fiche de la visite.

### B. Prise en charge et Compte-rendu
1. Sur la fiche de visite, cliquez sur **"Prendre en charge cette visite"**. La visite passe au statut **"En entretien"**, signalant à la réception que le visiteur est entré dans votre bureau.
2. **Pendant l'entretien** : Vous pouvez saisir des remarques dans le champ *"Observations en cours d'entretien"* et cliquer sur *"Sauvegarder les observations"*.
3. **Clôture et Rapport** : Une fois la visite terminée, vous devez obligatoirement rédiger un **Compte rendu final** (décisions prises, résumé, étapes suivantes).
4. Sélectionnez le statut final :
   - *Traité* : La visite s'est déroulée et s'est terminée avec succès.
   - *À relancer* : Des actions de suivi sont requises ultérieurement.
   - *Transformé* : S'il s'agit d'une opportunité commerciale/prospect qualifié.
5. Cliquez sur **"Clôturer la visite"**.

---

## 4. MODULE DE FACTURATION & CAISSE (Comptabilité)

Ce module permet de générer des factures pour les visites payantes (prestation de services) et d'encaisser les règlements.

### A. Configurer une facturation (Comptable / Responsable)
Sur une fiche de visite active ou en cours :
1. Cliquez sur **"Configurer facturation"** (si aucun devis/facture n'est déjà en place).
2. Cochez **"Assujetti à facturation"** sur *Oui*.
3. Sélectionnez les prestations fournies à partir du catalogue des tarifs de votre service.
4. Ajustez les quantités. Le montant global se calcule automatiquement.
5. Définissez le *Délai de réalisation estimé* et sélectionnez le service responsable de la prestation.
6. Cliquez sur **"Enregistrer"**.

### B. Enregistrer un règlement (Caissier)
1. Ouvrez le registre de facturation ou recherchez le code visite.
2. Cliquez sur le bouton **"Enregistrer un règlement"** sur la fiche de facturation.
3. Saisissez le montant versé par le client (encaissement complet ou acompte).
4. Validez. Le reçu est mis à jour en temps réel et le statut passe à *"Payé"* ou *"Partiellement payé"*.
5. Cliquez sur **"Imprimer Facture / Reçu"** pour générer un document A4 propre à remettre au client.

---

## 5. MODULE INFIRMERIE (Espace Santé & Soins)

Ce module est divisé en deux espaces distincts pour assurer le strict respect du secret médical.

### A. Espace Collaborateur (Personnel)
Chaque collaborateur dispose d'un espace confidentiel accessible via l'icône **"Infirmerie"** :
- **Mon Dossier Santé** : Visualisez votre groupe sanguin, vos allergies connues et vos traitements déclarés.
- **Déclarer un Soin / Consultation** : Remplissez un court formulaire pour signaler des symptômes à l'infirmier ou demander une consultation.
- **Mes Rendez-vous médicaux** : Effectuez une demande de rendez-vous directement auprès de l'infirmerie en choisissant le jour et l'heure souhaités.

### B. Espace Infirmier (Professionnel de santé)
L'infirmier dispose d'un espace de travail complet divisé en plusieurs onglets :
1. **Tableau de bord** : Statistiques quotidiennes, alertes sur les stocks de médicaments faibles et produits périmés.
2. **Dossiers** : Fiches cliniques détaillées de tous les collaborateurs. C'est ici que l'infirmier renseigne les allergies, antécédents, vaccinations et traitements en cours.
3. **Pharmacie** : Gestion du stock de médicaments de l'entreprise. Permet d'enregistrer des entrées de stock ou des consommations courantes.
4. **Agenda** : Validation des demandes de rendez-vous des collaborateurs ou planification de visites périodiques de médecine du travail.
5. **Ordonnances** : Générateur d'ordonnances médicales formatées A4 prêtes à être imprimées et signées.
6. **Repos Médicaux** : Émission de fiches de repos médical. Lorsqu'une fiche est émise, elle est envoyée aux RH pour validation de l'absence.

---

## 6. ESPACE RH & POINTAGE (Présence & Déplacements)

Ce module permet de suivre l'assiduité du personnel de l'entreprise.

### A. Pointage journalier (Collaborateur)
1. À votre arrivée au bureau, rendez-vous sur la page **"Espace RH"**.
2. Cliquez sur **"Pointer Arrivée"**. Si l'entreprise utilise la validation V3, le système vous demandera d'autoriser la géolocalisation pour valider que vous êtes bien sur le site de l'entreprise.
3. Vous pouvez pointer de la même manière vos **Début/Fin de pause** et votre **Départ** en fin de journée.
4. Le pointage peut également se faire en scannant le QR code affiché à l'accueil via votre smartphone.

### B. Gestion des Missions hors site
Si vous devez vous déplacer chez un client ou effectuer une course professionnelle :
1. Sur la page **"Missions"**, cliquez sur **"Créer une mission"**.
2. Renseignez la destination, le motif, l'heure de départ prévue et l'heure de retour estimée.
3. Au moment de partir, cliquez sur **"Démarrer la mission"** (le système capture vos coordonnées GPS de départ).
4. À votre retour, cliquez sur **"Terminer la mission"** (le système capture les coordonnées de fin).

### C. Validation RH (Directeur / RH)
Les responsables RH et la Direction générale disposent d'un écran de contrôle :
- **Suivi des présences** : Visualisez en temps réel qui est présent, en pause, en mission ou absent aujourd'hui.
- **Demandes d'absences / permissions** : Examinez, approuvez ou rejetez les demandes de congés et de permissions déposées par les employés.
- **Absences médicales** : Validez administrativement les fiches de repos médical transmises par l'infirmier(ère).

---

## 7. ADMINISTRATION ET RÉGLAGES (Configuration)

### A. Création et gestion des comptes utilisateurs
1. Connectez-vous avec le compte administrateur racine (configuré lors du premier démarrage via `/setup`).
2. Allez dans le menu **"Utilisateurs"** puis cliquez sur **"Nouvel utilisateur"**.
3. Saisissez l'adresse email, le nom complet, le mot de passe initial, le service d'affectation et le **rôle** (ex: *collaborateur*, *nurse*, *cashier*, etc.).
4. Cliquez sur **"Enregistrer"**.

### B. Configuration des services de l'entreprise
1. Allez dans le menu **"Services"**.
2. Vous pouvez activer/désactiver des départements de l'entreprise, modifier leurs descriptions ou assigner un responsable de service.
3. Les tarifs et catalogues de prestations facturables sont également configurés par service dans ce volet.
