# Plan d'Implémentation — Jacmat Admin Dashboard & Système d'Authentification Sécurisé

Ce plan détaille la conception et l'implémentation d'une suite d'administration complète, sécurisée et professionnelle pour la boutique **JACMAT STORE**, permettant au propriétaire de gérer ses produits, catégories et paramètres sans toucher au code source, avec un fonctionnement immédiat en local et une compatibilité totale pour un futur déploiement sur **Vercel**.

---

## 1. Audit de l'Architecture Existante

- **Framework** : Vanilla JavaScript (ES Modules modernes), HTML5 sémantique, CSS modulaire (`src/css/`).
- **Build System** : Vite 6 Multi-Page Application (MPA) générant les points d'entrée HTML dans `dist/`.
- **Catalogue actuel** : 20 produits réels dans `products.json` avec variantes de tailles, statuts (`soldOut`, `preOrder`), et 79 images locales dans `images/`.
- **Catégories actuelles** : Déduites dynamiquement via mots-clés dans `src/js/api.js` (`tops`, `outerwear`, `accessories`).
- **Routage Vercel** : `vercel.json` configuré avec `cleanUrls: true` et en-têtes de sécurité.
- **Boutique publique** : Panier via `localStorage`, passage de commande Web3Forms et conciergerie WhatsApp (+243 82 320 7915).

---

## 2. Architecture de Sécurité & Authentification

Conformément à la règle critique de sécurité, **aucune vérification n'est effectuée côté client**. Le mot de passe n'est jamais stocké ni transmis en clair au navigateur.

```
┌─────────────────┐       POST /api/admin/login        ┌──────────────────────────────┐
│  /admin/login   │ ─────────────────────────────────> │   Serveur / Serverless API   │
│ (Email + Pass)  │                                    │                              │
└─────────────────┘                                    │ 1. Vérifie ADMIN_EMAIL       │
                                                       │ 2. bcrypt.compare(pass, HASH)│
                                                       │ 3. Signe JWT (jose HS256)    │
                                                       │ 4. Rate-limiting anti-brute  │
┌─────────────────┐  Set-Cookie: jacmat_admin_session  └──────────────────────────────┘
│  Navigateur     │ <─────────────────────────────────                │
│  (httpOnly)     │                                                   │
└─────────────────┘                                                   ▼
         │                                             ┌──────────────────────────────┐
         │ Requêtes authentifiées                      │  Endpoints Protégés          │
         └───────────────────────────────────────────> │  verifyAdminSession(req)     │
                                                       │  401 si session invalide     │
                                                       └──────────────────────────────┘
```

- **Variables d'environnement** :
  - `ADMIN_EMAIL` : Email de l'administrateur.
  - `ADMIN_PASSWORD_HASH` : Hachage bcrypt (coût 12) du mot de passe.
  - `SESSION_SECRET` : Clé cryptographique aléatoire (minimum 32 caractères) pour signer le jeton JWT.
  - `DATABASE_URL` : Chaîne de connexion PostgreSQL (Neon / Supabase) pour Vercel et production.
- **Propriétés du Cookie de Session** :
  - `HttpOnly: true` (inaccessible au JavaScript client, immunisé contre les attaques XSS).
  - `SameSite: 'Lax'` (protection CSRF).
  - `Path: '/'`.
  - `Max-Age: 36000` (durée de validité de 10 heures).
  - `Secure: true` en production HTTPS.
- **Protection Brute-Force** : Limitation à 5 tentatives échouées par fenêtre de 15 minutes par adresse IP.
- **Script de hachage de mot de passe** : `npm run admin:hash-password` (`scripts/hash-password.js`).

---

## 3. Persistance des Données & Couche d'Accès (Data Access Layer)

- **Double stratégie Local / Vercel** :
  1. **Production / Avec Base de Données (`DATABASE_URL`)** : Connexion à une base PostgreSQL (ex: Neon serverless ou Supabase PostgreSQL) via `pg`.
  2. **Développement Local Autonome** : Si `DATABASE_URL` n'est pas encore configuré, le système utilise automatiquement un stockage persistant local (`data/store.json`), pré-rempli avec les 20 produits existants. Cela permet au développeur ou propriétaire de tester immédiatement 100% de l'administration en local sans dépendance externe obligatoire.
- **Migration & Préservation** :
  - Un script d'initialisation et d'amorçage (`scripts/seed.js` et fonction `initDatabase()`) migre automatiquement les 20 produits de `products.json` vers la table `products` avec leurs images, prix, variantes et statuts, sans aucune perte de données.
- **Schéma Produit** :
  ```ts
  Product {
    id: string;              // uuid ou slug unique
    name: string;            // ex: "SS80"
    slug: string;            // ex: "ss80"
    description: string;     // texte de présentation
    price: number;           // ex: 45
    salePrice: number | null;// prix promotionnel optionnel
    category: string;        // "tops" | "outerwear" | "accessories" | personnalisée
    images: string[];        // tableau d'URLs ou chemins relatifs (/images/...)
    variants: { [key: string]: string[] }; // ex: { "Taille": ["S", "M", "L", "XL"] }
    soldOut: boolean;        // rupture de stock
    preOrder: boolean;       // pré-commande
    status: 'published' | 'draft'; // visibilité boutique
    createdAt: string;
    updatedAt: string;
  }
  ```

---

## 4. Endpoints API & Intégration Vite / Vercel

### Architecture d'Exécution
- **Sur Vercel** : Les fichiers dans `api/` sont exécutés nativement en tant que Vercel Serverless Functions.
- **En Local (`npm run dev`)** : Un middleware Vite (`vite.config.js`) intercepte `/api/*` et délègue au même routeur d'API Node.js. Port unique (`http://localhost:5173`), cookies partagés, aucun problème CORS.

### Endpoints
| Méthode | Route | Rôle | Accès |
|---|---|---|---|
| `POST` | `/api/admin/login` | Authentification & création du cookie de session | Public (Rate-limited) |
| `POST` | `/api/admin/logout` | Invalidation du cookie de session | Public |
| `GET` | `/api/admin/me` | Vérification de la session admin actuelle | Admin |
| `GET` | `/api/admin/stats` | Métriques réelles (total, publiés, brouillons, épuisés, catégories) | Admin |
| `GET` | `/api/admin/products` | Liste complète des produits (y compris brouillons) | Admin |
| `POST` | `/api/admin/products` | Création d'un produit (validation + auto-slug) | Admin |
| `PUT` | `/api/admin/products/:id` | Modification d'un produit | Admin |
| `DELETE` | `/api/admin/products/:id` | Suppression sécurisée d'un produit | Admin |
| `GET` | `/api/admin/categories` | Liste des catégories avec comptage | Admin |
| `POST` | `/api/admin/categories` | Ajout d'une catégorie | Admin |
| `DELETE` | `/api/admin/categories/:id` | Suppression (bloquée si produits associés) | Admin |
| `GET` | `/api/admin/settings` | Lecture des paramètres généraux de la boutique | Admin |
| `PUT` | `/api/admin/settings` | Mise à jour des paramètres généraux (nom, contact, whatsapp) | Admin |
| `POST` | `/api/admin/upload` | Upload et prévisualisation d'images (Blob/Cloudinary/Local) | Admin |
| `GET` | `/api/products` | Liste des produits publiés (boutique publique) | Public |
| `GET` | `/api/products/:id` | Détail d'un produit publié | Public |

---

## 5. Interface d'Administration (Pages & Composants)

Design épuré et moderne, fidèle à l'identité monochrome noir & blanc de Jacmat, avec typographie `Inter`.

- **`/admin/login`** : Page de connexion sobre avec logo Jacmat, champs Email/Mot de passe, bascule de visibilité, état de chargement, message d'erreur générique.
- **`/admin`** : Tableau de bord affichant les indicateurs réels (Total produits, Produits publiés, Brouillons, Ruptures de stock, Catégories), les derniers articles ajoutés, et des raccourcis d'action rapide.
- **`/admin/products`** : Gestion du catalogue avec tableau haute lisibilité (bureau) et cartes compactes (mobile), recherche en direct, filtres par catégorie et par statut (Publié / Brouillon / Épuisé), bascule rapide d'état, bouton d'ajout.
- **`/admin/products/new` & `/admin/products/edit`** : Formulaire de création / édition avec génération automatique du slug, sélection de catégorie, gestion des prix, statuts, sélection interactive des tailles (S à 3XL, pointures), téléversement et ordonnancement des photos de la galerie.
- **`/admin/categories`** : Gestion des catégories avec vérification d'intégrité (interdiction de supprimer une catégorie liée à des produits).
- **`/admin/settings`** : Configuration des coordonnées de contact et informations d'environnement système (statut de la base, rotation du mot de passe).
- **Sécurité SEO** : `<meta name="robots" content="noindex, nofollow">` présent sur toutes les pages d'administration.

---

## 6. Intégration avec la Boutique Publique

- Mise à jour de [src/js/api.js](file:///h:/jacmat/src/js/api.js) :
  - `fetchProducts()` interroge en priorité `/api/products`.
  - Seuls les produits avec le statut `status === 'published'` sont renvoyés aux clients de la boutique publique. Les brouillons restent invisibles.
  - En cas de coupure de l'API, repli transparent sur `products.json`.
  - Toute modification (prix, disponibilité, description, nouveaux articles) effectuée dans l'administration apparaît immédiatement sur la boutique publique.

---

## 7. Plan de Vérification

### Tests Automatisés & Scripts
1. Test du script de hachage de mot de passe : `npm run admin:hash-password`.
2. Initialisation des données : `npm run db:seed`.
3. Validation du build de production Vite : `npm run build` (vérification de la compilation de toutes les pages admin dans `dist/`).

### Tests Fonctionnels (Local)
1. **Sécurité Authentification** :
   - Tentative d'accès à `/admin` sans cookie -> redirection automatique vers `/admin/login`.
   - Identifiants incorrects -> rejet avec message "Identifiants incorrects." et blocage après 5 essais.
   - Identifiants valides -> redirection vers `/admin` avec cookie `jacmat_admin_session`.
   - Clic sur "Déconnexion" -> suppression du cookie et retour à `/admin/login`.
2. **Gestion des Produits (CRUD)** :
   - Création d'un nouveau produit avec statut "Brouillon" -> visible dans `/admin/products`, absent de la boutique publique.
   - Passage en statut "Publié" -> apparition immédiate dans `/shop` et `/product?p=...`.
   - Modification du prix et des photos -> répercussion immédiate.
   - Boîte de dialogue de confirmation avant suppression.
3. **Sécurité Git** :
   - Vérification de l'absence de fichiers `.env` ou de clés secrètes dans l'historique Git.
