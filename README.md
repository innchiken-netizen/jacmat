# JACMAT STORE — Streetwear Premium & Drops Exclusifs

> **« BE YOU & WEAR US »**  
> Plateforme e-commerce officielle de la marque émergente de streetwear **JACMAT STORE**, fondée à Kinshasa (RDC) par Jacky & Matthieu.

Site web en production : [https://jacmat.store](https://jacmat.store)

---

## 1. Vue d'ensemble du Projet

JACMAT STORE est une marque contemporaine combinant culture urbaine, finitions haut de gamme et engagement d'authenticité. Ce projet est une refonte complète et une modernisation intégrale du site web historique, conçue selon les standards des plus grands labels de streetwear contemporains (Kith, Supreme, Represent, Daily Paper, Fear of God).

### Fonctionnalités Clés
- **Expérience d'achat fluide** : Catalogue complet de 20 pièces streetwear, filtrage instantané par catégorie (*Tops*, *Outerwear*, *Accessoires*), recherche textuelle en temps réel et tri multi-critères.
- **Tiroir Panier Intelligent (Slide-over Cart Drawer)** : Volet latéral accessible en permanence, avec agrégation automatique des pièces identiques, gestion des quantités et calcul immédiat des totaux.
- **Sélecteur de Variantes Accessible** : Choix des tailles (*S, M, L, XL, 2XL, 3XL*), coloris et modèles de coques iPhone via une modale tactile fluide.
- **Canal de Conversion WhatsApp Direct** : Génération de messages pré-formatés en 1 clic pour commander une pièce individuelle ou l'intégralité du panier directement auprès de l'équipe Jacmat (+243 82 320 7915).
- **Formulaire de Commande Web3Forms** : Envoi asynchrone sécurisé des coordonnées de livraison avec validation et redirection vers la page de remerciement `/thanks`.
- **Garantie d'Authenticité & Remplacement** : Engagement de remplacement immédiat en cas de problème sur un produit certifié authentique.
- **Performance & SEO** : Balises Open Graph complètes, Twitter Cards, balisage Schema.org (`ClothingStore`, `Product`), score Lighthouse optimal.

---

## 2. Stack Technologique

- **Architecture** : Application Multi-Pages (MPA) moderne propulsée par [Vite](https://vitejs.dev/)
- **Frontend** : HTML5 sémantique, CSS3 moderne avec Système de Design Tokens natif, JavaScript ES Modules
- **Hébergement & CDN** : [Vercel](https://vercel.com/) avec `cleanUrls: true` et en-têtes de sécurité
- **Backend & Prise de Commande** : Web3Forms API REST
- **Messagerie & Vente Directe** : WhatsApp Business API
- **Analytics** : Google Analytics 4 (`G-YK5QZMXE8J`)

---

## 3. Installation Locale

### Prérequis
- [Node.js](https://nodejs.org/) (version 18 ou supérieure recommandée)
- `npm` (inclus avec Node.js)

### Cloner et installer les dépendances
```bash
# Cloner le dépôt GitHub
git clone https://github.com/votre-compte/jacmat.git
cd jacmat

# Installer les dépendances
npm install
```

---

## 4. Commandes de Développement & Build

### Lancer le serveur de développement local
```bash
npm run dev
```
Le site sera accessible localement sur `http://localhost:3000` (ou le port indiqué par Vite) avec rechargement à chaud (HMR).

### Générer le build de production
```bash
npm run build
```
Les fichiers compilés, minifiés et optimisés sont générés dans le dossier `dist/`.

### Prévisualiser le build de production localement
```bash
npm run preview
```

---

## 5. Variables d'Environnement

Un fichier `.env.example` est fourni à la racine du projet pour documenter les variables configurables :

| Variable | Description | Valeur par défaut / Exemple |
| :--- | :--- | :--- |
| `VITE_WEB3FORMS_ACCESS_KEY` | Clé d'API Web3Forms pour la réception des commandes | `b381bcb5-2bba-4e6b-a483-c36a6fdafaf8` |
| `VITE_WHATSAPP_PHONE` | Numéro WhatsApp officiel Jacmat pour la conciergerie | `243823207915` |
| `VITE_GA_ID` | Identifiant de suivi Google Analytics 4 | `G-YK5QZMXE8J` |
| `VITE_SITE_URL` | URL canonique du site en production | `https://jacmat.store` |

---

## 6. Déploiement sur Vercel

Le projet est configuré pour être déployé en 1 clic sur Vercel sans configuration supplémentaire :

1. Poussez votre code sur GitHub :
   ```bash
   git add .
   git commit -m "feat: complete redesign and modernization of Jacmat Store"
   git push origin main
   ```
2. Rendez-vous sur votre tableau de bord [Vercel](https://vercel.com/) et cliquez sur **« Add New Project »**.
3. Importez votre dépôt GitHub `jacmat`.
4. Vercel détecte automatiquement la configuration :
   - **Framework Preset** : `Vite`
   - **Build Command** : `vite build`
   - **Output Directory** : `dist`
5. Cliquez sur **Deploy**.
6. Dans les paramètres de domaine de Vercel, associez votre domaine personnalisé `jacmat.store`.

Le fichier `vercel.json` gère automatiquement :
- Les **Clean URLs** (accès à `/shop`, `/product`, `/cart`, `/thanks` sans extension `.html`)
- La mise en cache immuable des 79 images du catalogue (`Cache-Control: public, max-age=31536000, immutable`)
- Les en-têtes de sécurité HTTP (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`).

---

## 7. Intégrations Importantes

- **WhatsApp Concierge** : `+243 82 320 7915` — Lien direct présent dans le header, les fiches produits (avec variantes sélectionnées), le panier et le footer.
- **Instagram Officiel** : `https://instagram.com/jacmatstore` (`@jacmatstore`).
- **Web3Forms** : Endpoint `https://api.web3forms.com/submit` pour l'acheminement des commandes par email vers les gérants de la boutique.
- **Google Analytics 4** : Suivi des sessions et conversions avec l'ID `G-YK5QZMXE8J`.

---

## 8. Structure des Dossiers

```
jacmat/
├── dist/                      # Fichiers de production prêts à déployer
├── images/                    # 79 photographies authentiques du vestiaire Jacmat
├── src/
│   ├── css/
│   │   ├── tokens.css         # Système de design tokens (couleurs, typographie, espacements)
│   │   ├── reset.css          # Reset moderne et gestion du reduced-motion
│   │   ├── components.css     # Header, tiroir panier, modales, boutons, badges, footer
│   │   ├── animations.css     # Animations d'apparition et micro-interactions
│   │   ├── main.css           # Feuille de style principale fédératrice
│   │   └── pages/
│   │       ├── home.css       # Styles spécifiques à la page d'accueil (Hero éditorial, bento)
│   │       ├── shop.css       # Styles de la boutique (filtres, grille, tri)
│   │       ├── product.css    # Fiche produit (galerie interactive, chips de tailles)
│   │       └── cart.css       # Page panier & validation de commande
│   └── js/
│       ├── config.js          # Constantes métier (WhatsApp, Web3Forms, Analytics)
│       ├── state.js           # Gestion réactive du panier & persistance localStorage
│       ├── api.js             # Chargement des produits, slugs et générateurs de liens WhatsApp
│       ├── components/
│       │   ├── header.js      # Navigation sticky, menu mobile et recherche
│       │   ├── cart-drawer.js # Volet panier coulissant avec gestion des quantités
│       │   ├── variant-modal.js # Modale tactile de sélection des variantes
│       │   └── toast.js       # Notifications toast discrètes
│       ├── pages/
│       │   ├── home.js        # Logique de la page d'accueil (drops vedettes, reveals)
│       │   ├── shop.js        # Logique boutique (filtres catégories, recherche, tri)
│       │   ├── product.js     # Logique fiche produit (galerie swipe, 1-tap buy WhatsApp)
│       │   └── cart.js        # Logique panier (steppers, soumission Web3Forms & WhatsApp)
│       └── main.js            # Point d'entrée principal et routeur d'initialisation
├── index.html                 # Page d'accueil éditoriale streetwear
├── shop.html                  # Boutique complète
├── product.html               # Fiche produit détaillée
├── cart.html                  # Panier et confirmation de commande
├── thanks/
│   └── index.html             # Page de remerciement et confirmation
├── 404.html                   # Page 404 personnalisée aux couleurs de la marque
├── products.json              # Base de données JSON des 20 produits
├── hero-image.jpg             # Photographie éditoriale mannequin officielle
├── logo.png                   # Logo officiel noir
├── logo white.png             # Logo officiel blanc
├── favicon.ico                # Favicon officielle
├── vercel.json                # Configuration Vercel (cleanUrls, en-têtes HTTP)
├── vite.config.js             # Configuration du bundler Vite Multi-Pages
├── package.json               # Dépendances et scripts npm
├── .gitignore                 # Exclusions Git propres pour la production
└── .env.example               # Documentation des variables d'environnement
```

---

## 9. Licence & Droits

Tous droits réservés &copy; 2026 **JACMAT STORE**.  
*BE YOU & WEAR US.*
