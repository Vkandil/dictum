# Plan d'expérience utilisateur et de providers pour Dictum

Proposition du 14 octobre 2026, basée sur l'audit du dépôt et la [recherche des modèles](transcription-provider-research.fr.md). Ce document conserve les décisions du plan. L'implémentation et ses validations sont décrites dans [le bilan](provider-implementation.fr.md).

## Décision produit

Dictum doit proposer dès son lancement un parcours recommandé avec OpenRouter, un parcours sans compte avec un moteur local géré par Dictum et un accès « Explorer les autres options ». Un débutant doit pouvoir réussir sa première dictée sans connaître les identifiants de modèles, les endpoints ou les runtimes.

Les deux parcours principaux sont visibles sur le même écran. OpenRouter est recommandé pour la simplicité de connexion et l'accès à plusieurs modèles ; le local est présenté clairement comme l'option sans facturation d'API et utilisable hors ligne après installation. Le catalogue complet est disponible dans Explorer et dans les réglages.

L'application reste destinée à Windows 10/11 x64 pour ce chantier, conformément au dépôt. Une couverture de la majorité des utilisateurs Windows ne doit pas être présentée comme une couverture mesurée de la population mondiale.

## Ce que signifie « les plus utilisés »

Le classement public OpenRouter porte sur les caractères transcrits durant les sept derniers jours sur cette plateforme. Il place actuellement MAI-Transcribe 2, Whisper Large v3 Turbo et Scribe v2 en tête, suivis de Whisper Large v3, Qwen3-ASR 0.6B et GPT-4o Mini Transcribe. Ce classement établit une adoption sur OpenRouter, pas un classement mondial ni une mesure de précision. Source : [classement officiel](https://openrouter.ai/collections/speech-to-text-models).

La sélection ci-dessous combine cet indicateur, la diffusion des familles locales, l'accès via des comptes déjà possédés et la compatibilité avec les besoins de dictée. On ne promet pas un pourcentage de couverture sans données comparables.

## Catalogue à livrer

### Services prioritaires

| Service | Modèles à proposer | Place dans le produit |
| --- | --- | --- |
| OpenRouter | Tous les modèles STT du catalogue, avec sélection courte de modèles validés | Parcours recommandé |
| OpenAI | GPT Transcribe, GPT-4o Transcribe, GPT-4o Mini Transcribe, Whisper ; GPT Live Transcribe dans le lot live | Connexion directe prioritaire |
| Groq | Whisper Large v3 Turbo et Large v3 | Connexion directe prioritaire |
| Mistral | Voxtral Mini Transcribe 2 et Voxtral Realtime | Connexion directe existante à améliorer |
| ElevenLabs | Scribe v2 et Scribe v2 Realtime | Adaptateur direct prioritaire |
| Deepgram | Nova-3 ; Flux multilingue pour le live ; Nova-2 selon langues | Adaptateur direct prioritaire |
| AssemblyAI | Universal-3.5 Pro, Universal-2, modèles streaming adaptés | Adaptateur direct prioritaire |
| Soniox | STT Async v4 et STT Realtime v4 | Adaptateur direct suivant |

Source des modèles et des contrats : [recherche détaillée](transcription-provider-research.fr.md), avec liens vers les documentations de chaque fournisseur. Les nouveaux modèles OpenAI nécessitent des paramètres différents des anciens ; une URL compatible ne règle pas toutes les capacités.

Dans OpenRouter, la sélection courte comprendra Voxtral Mini Transcribe, Whisper Large v3 Turbo, MAI-Transcribe 2, Scribe v2 et GPT Transcribe. Les autres modèles, dont Whisper Large v3, GPT-4o Mini, Qwen3-ASR, Parakeet, Gemini Transcribe, Chirp, Grok, Fish Audio et Meta Muse, restent accessibles dans Explorer. Le modèle recommandé initial reste Voxtral Mini Transcribe, déjà utilisé par Dictum ; les nouveaux candidats ne remplacent ce choix qu'après validation sur un corpus de dictée. Un changement de recommandation ne modifie pas le choix explicite d'une installation existante.

Les noms de modèles disponibles sur OpenRouter sont découverts avec `GET /models?output_modalities=transcription`. Le client actuel est déjà proche du contrat STT ; ajouter les modèles à l'interface et exploiter leurs capacités reste nécessaire. Sources : [API du catalogue](https://openrouter.ai/api/v1/models?output_modalities=transcription) et [documentation STT](https://openrouter.ai/docs/guides/overview/multimodal/stt).

### Services supplémentaires dans Explorer

Prévoir Gladia/Solaria, Speechmatics, Google Cloud/Chirp, Google Gemini Transcribe, Azure Speech, AWS Transcribe, Cartesia/Ink, Rev AI, Cohere Transcribe et Sarvam/Saaras pour les langues concernées. Leurs connecteurs directs viennent après le socle courant, sauf demande utilisateur précise. Les modèles déjà exposés via OpenRouter sont accessibles plus tôt par cette voie.

Fireworks, Together et DeepInfra restent des candidats pour des presets d'API compatibles, à ajouter après vérification du modèle STT effectivement disponible et du contrat complet. L'étiquette « API compatible OpenAI » ne constitue pas seule une preuve de prise en charge audio.

Une connexion « Serveur compatible / personnalisé » reste disponible pour Speaches, serveurs Whisper, vLLM, LocalAI et serveurs Qwen compatibles vérifiés. Le formulaire accepte l'authentification facultative et précise les capacités validées. Le preset whisper.cpp doit gérer son endpoint réel, par défaut `/inference`. Ollama n'est pas présenté comme un provider STT prêt à l'emploi : sa [documentation de compatibilité](https://docs.ollama.com/api/openai-compatibility) ne décrit pas `/audio/transcriptions`.

### Modèles locaux gérés par Dictum

| Priorité | Modèles | Objectif |
| --- | --- | --- |
| Premier lot local | Whisper base/small, Large v3 Turbo, Large v3, variantes quantifiées validées | Couvrir les CPU modestes et les besoins multilingues courants |
| Deuxième lot local | Parakeet TDT 0.6B v3 ; Qwen3-ASR 0.6B et 1.7B | Alternatives compactes multilingues |
| Lot live local | Voxtral Realtime 4B ; Nemotron 3.5 ASR Streaming ; Moonshine selon langues | Vraie dictée streaming, validée pour chaque moteur |
| Explorer local | Canary 1B v2, Canary-Qwen 2.5B, Cohere Transcribe 2B, Granite Speech 4.1, Vosk, Distil-Whisper, VibeVoice-ASR, Meta Omnilingual ASR, SenseVoice/FunASR | Besoins de langue, de matériel ou de transcription spécialisés |

Chaque entrée précise les langues, la licence des poids, le moteur compatible, la taille de téléchargement et les modes validés. Le moteur et les poids sont deux composants différents : Whisper via whisper.cpp ne charge pas tous les modèles Hugging Face.

Pour le français, utiliser les variantes Whisper multilingues et Parakeet v3 ; ne pas recommander les variantes `.en`, Parakeet v2 ni les Distil-Whisper officiels anglais. Qwen annonce 30 langues et 22 dialectes chinois, et non 52 langues distinctes. Sources : [Qwen3-ASR](https://huggingface.co/Qwen/Qwen3-ASR-0.6B), [Parakeet v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3).

Un moteur batch pouvant traiter des petits blocs ne reçoit pas automatiquement le badge « Live ». L'accès CPU ne garantit pas non plus la vitesse sur toute machine. Les recommandations matérielles sont validées par des mesures locales.

## Premier lancement : trois écrans

### Écran 1 — « Comment voulez-vous utiliser Dictum ? »

Carte ouverte par défaut :

> **Démarrer facilement — recommandé**
>
> Avec OpenRouter, une clé vous donne accès à plusieurs modèles. Votre audio est envoyé au service choisi. Dictum est gratuit ; l'utilisation du service est facturée séparément.
>
> **Obtenir une clé OpenRouter** · **J'ai déjà une clé**
>
> Champ masqué : « Collez votre clé »
>
> **Vérifier et continuer**

L'aide liée à la création du compte donne les étapes concrètes : créer le compte, ajouter des crédits si nécessaire, créer une clé, la coller. Aucun identifiant de modèle ou prix approximatif commun à tous les services n'est affiché ici. La clé est conservée dans Windows Credential Manager et reste hors des journaux.

Deuxième carte visible :

> **Sur cet ordinateur — sans compte**
>
> Installez un modèle pour dicter hors ligne. Dictum vous propose une option adaptée à votre ordinateur et s'occupe du téléchargement.
>
> **Configurer le mode local**

Une troisième action ouvre le catalogue : **Explorer les autres options**. Elle ne requiert pas de passer par OpenRouter. Les utilisateurs disposant déjà d'une clé choisissent directement leur service.

Dans le parcours local, afficher une recommandation et deux alternatives au maximum : léger, équilibré, précision. Afficher avant le téléchargement sa taille, les besoins matériels estimés et la langue. Conserver la progression, proposer pause/reprise/annulation, puis charger le moteur et vérifier qu'il est prêt. Une installation interrompue reprend au lancement suivant.

Le parcours « sans compte » n'est publié comme prêt à l'emploi qu'une fois le moteur local livré. Dans une release intermédiaire, l'action existante doit s'appeler honnêtement « Connecter mon serveur local » et vérifier ce serveur avant de continuer.

### Écran 2 — « Votre micro et votre raccourci »

Sélectionner le micro système par défaut, afficher le niveau sonore, conserver le test micro sans transcription, puis proposer un raccourci dont la disponibilité est vérifiée. L'utilisateur peut en enregistrer un autre. Le changement de micro ou de raccourci ne réinitialise pas la connexion.

La langue parlée est auto par défaut avec possibilité de sélectionner une langue ou plusieurs langues lorsqu'elles sont prises en charge. La langue de l'interface est indépendante : chaînes externalisées, français et anglais au premier lot, formatage des nombres/unités et repli anglais. Le réglage de langue d'interface n'enferme pas l'utilisateur dans une langue parlée.

### Écran 3 — « Essayez votre première dictée »

Un bouton démarre et arrête l'enregistrement. Le transcript s'affiche dans Dictum et reste copiable. Une phrase exemple est facultative. L'envoi de l'audio au service cloud intervient seulement lorsque l'utilisateur lance ce test ; le coût éventuel est indiqué.

La validation distingue : micro fonctionnel, clé reconnue ou moteur prêt, transcription réussie. Une clé acceptée via `/models` ne prouve pas que les crédits et les droits d'inférence sont suffisants.

Après réussite : bouton **Commencer à dicter** et rappel visuel du raccourci. Si le test échoue, proposer l'action adaptée : remplacer la clé, ouvrir la facturation, changer de modèle, réessayer, vérifier le réseau, reprendre un téléchargement ou sélectionner un modèle plus léger. Ne pas clôturer l'installation comme « prête » après un échec. L'utilisateur peut néanmoins choisir « Configurer plus tard » et accéder aux réglages, avec un état visible « À terminer ».

## Explorer et réglages

Un écran « Transcription » propose les onglets Services en ligne, Sur cet ordinateur et Serveur personnalisé. Les modèles sont une section de cet écran ; il n'est pas nécessaire d'ajouter une entrée principale à la barre latérale.

Cartes avec nom familier, courte explication, statut « Connecté / À configurer / Installé / À télécharger », et badges réellement vérifiés : français, multilingue, hors ligne, live, vocabulaire personnalisé. Recherche et filtres par langue, live et exécution locale. Trois ou cinq recommandations visibles, puis le catalogue complet.

Séparer les notions de service et de modèle. OpenRouter est un service d'accès ; Whisper et Scribe sont des familles de modèles. Présenter par exemple « Whisper Large v3 Turbo · via OpenRouter » ; une fiche peut proposer la connexion directe quand elle existe. Ne jamais imposer deux clés pour accéder à un modèle déjà fourni par la connexion sélectionnée.

Le choix d'un nouveau service utilise un modèle par défaut compatible, explique les fonctions disponibles et réutilise la clé sauvegardée. Un changement de provider ne détruit ni la clé ni le choix de modèle précédent ; mémoriser les préférences par service et par mode.

Les identifiants, l'adresse de serveur, les headers et le JSON restent dans « Réglages avancés ». L'aide, les labels et la navigation sont utilisables au clavier, avec lecteur d'écran ; aucune information essentielle ne dépend seulement d'une couleur.

### Coût, confidentialité et nettoyage

Le statut d'exécution découle du chemin effectif : sur cet ordinateur, sur un serveur configuré ou dans le cloud. Une absence de clé API ne prouve pas que l'audio reste sur le PC.

Les tarifs affichés viennent d'une source datée et précisent le mode de facturation. Un modèle facturé au token n'affiche pas une estimation fixe à la minute sans méthode validée. Une donnée manquante donne « Tarif à consulter », jamais « gratuit ». Distinguer coût de l'ASR et coût du nettoyage.

Séparer le provider de transcription du provider de nettoyage IA. En mode local, le nettoyage est local ou désactivé par défaut. Un choix explicite permet le nettoyage cloud et explique que le texte y sera envoyé. Le changement de profil ne déclenche jamais un transfert externe implicite.

Conserver la demande de non-rétention quand elle est disponible. Si la politique ZDR empêche le routage, expliquer cette incompatibilité et proposer une alternative compatible ; ne pas assouplir silencieusement la politique. La non-rétention ne signifie pas que l'inférence s'exécute localement.

Le provider de secours reste optionnel. Un profil local ne bascule dans le cloud que si l'utilisateur a configuré ce secours en connaissance de cause. Le résultat indique lorsqu'un secours a été utilisé.

## Architecture retenue

Conserver `TranscriptionProvider` comme interface indépendante de la capture et de l'insertion. Ajouter des adaptateurs de fournisseurs plutôt que des conditions sur les noms des modèles.

Un catalogue commun backend/frontend décrit : service, modèle, transport, batch/live, langues, paramètres, vocabulaire, confidentialité, prix daté, licence et matériel. Les données distantes sont fusionnées avec des presets validés et mises en cache ; une indisponibilité du catalogue ne bloque ni une configuration existante ni un modèle installé. Un modèle apparu dans le catalogue distant peut être marqué « non encore validé par Dictum » sans être recommandé.

Pour le premier moteur local, retenir **whisper.cpp intégré au backend Rust via whisper-rs**, sur un worker d'inférence dédié. Aucun Python, Docker, terminal ou serveur n'est demandé à l'utilisateur. Commencer par un chemin CPU fiable, puis valider Vulkan/CUDA sur les packages Windows cibles. Sources : [whisper.cpp](https://github.com/ggml-org/whisper.cpp), [bindings whisper-rs](https://github.com/tazz4843/whisper-rs).

Le moteur local reste une implémentation du même trait. Un gestionnaire charge et réutilise le modèle, contrôle la concurrence et libère la mémoire selon besoin. Adapter le découpage audio au moteur : ne pas lancer sans limite les inférences de blocs sur un PC. Prévoir annulation, attente explicite du chargement et erreur de mémoire exploitable.

Ajouter ensuite un backend compatible Parakeet, par exemple sherpa-onnx, après validation des conversions et de la licence des poids. Qwen dispose de son adaptateur de runtime : la prise en charge des poids et du serveur doit être testée avant le badge « prêt à installer ». Le parcours serveur expert reste disponible pendant ces ajouts. Source : [sherpa-onnx](https://k2-fsa.github.io/sherpa/onnx/).

Les poids sont téléchargés depuis des références versionnées d'un catalogue maintenu, avec taille attendue, SHA-256, fichier temporaire et activation après vérification. Ils sont stockés dans un dossier de données local configurable ; un modèle téléchargé n'augmente pas la taille de l'installateur initial. Prévoir manque d'espace, reprise, suppression et import avancé dans un format effectivement pris en charge. Les clés et l'audio ne sont jamais inclus dans la synchronisation des modèles.

Les manifestes personnalisés restent des données. Ils ne deviennent pas un mécanisme d'installation ou d'exécution de code tiers. Les moteurs natifs sont des dépendances versionnées du projet et doivent passer la validation des packages Windows et des licences.

## Lots d'implémentation et critères de réussite

| Lot | Travail | Critère de sortie |
| --- | --- | --- |
| 1 — Socle et catalogue | Métadonnées par modèle, migration des réglages, séparation ASR/nettoyage, catalogue OpenRouter, presets OpenAI/Groq, correction Voxtral Small et vocabulaire OpenRouter | Choix compatible, installations existantes préservées, aucun modèle de TTS dans le catalogue STT |
| 2 — Connexion et onboarding | Trois écrans, OpenRouter recommandé, Explorer, clés réutilisées, erreurs actionnables, parcours serveur vérifié, chaînes français/anglais | Un nouvel utilisateur cloud réalise sa première dictée sans saisir un modèle ni un endpoint |
| 3 — Local sans compte | whisper-rs, worker, téléchargement/gestion des modèles, recommandations matérielles, états de progression, CPU puis accélération validée | Première dictée locale depuis un Windows propre ; fonctionnement hors ligne après téléchargement |
| 4 — Choix direct et local étendu | Adaptateurs ElevenLabs/Deepgram/AssemblyAI/Soniox ; Parakeet puis Qwen | Chaque carte disponible correspond à une intégration réellement testée |
| 5 — Live | Adaptateurs cloud/live, Voxtral et Nemotron locaux, choix compatible, raccourcis adaptés | Texte partiel et final cohérent, arrêt/annulation/reconnexion sans duplication |
| 6 — Catalogue spécialisé | Providers entreprise, modèles par langue, gestion avancée des serveurs et imports | Fonctions vérifiées et documentation de chaque connexion ; absence de promesses non testées |

Les lots livrent des changements séparés et reviewables. Le dépôt demande une discussion avant les grandes modifications d'architecture : préparer la proposition pour le moteur local et la migration avant cette implémentation. Ce plan ne crée ni ne publie d'issue.

Validation d'implémentation : tests de payloads et de parsing par fournisseur, migration des settings, états de l'onboarding, téléchargement interrompu/corrompu, annulation et ordonnancement local. Exécuter les commandes de validation du README, dont build frontend, tests, fmt/clippy et tests Rust avec la régression audio de 75 secondes ; tester aussi l'installation Windows propre et le CLI.

Un corpus commun de français/anglais avec accents, bruit, silences, nombres, acronymes et changement de langue vérifie précision et délai. Tester au moins une machine CPU sans GPU dédié, une machine avec GPU NVIDIA et un chemin d'accélération non NVIDIA lorsque proposé. Mesurer chargement, délai après arrêt, RAM/VRAM, complétude et erreurs sur silence. L'annonce d'un support GPU ou live dépend de ces résultats.

La réussite UX se vérifie avec des utilisateurs débutants : ils peuvent identifier le coût et la destination de leurs données, connecter leur compte ou installer un modèle, réussir une dictée, changer d'option et récupérer d'une erreur sans terminal. Ces observations peuvent être réalisées sans ajouter de télémétrie au produit.
