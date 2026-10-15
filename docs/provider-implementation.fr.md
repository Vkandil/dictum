# Bilan de l’intégration des providers et du parcours de configuration

Travail réalisé à partir du [plan](provider-experience-plan.fr.md) et de la [recherche documentée](transcription-provider-research.fr.md), datés du 14 octobre 2026. La configuration est implémentée dans le dépôt ; aucune publication GitHub ni installation sur le système de l’utilisateur n’a été effectuée.

## Parcours livré

Le premier écran présente **Démarrer facilement**, avec OpenRouter recommandé, **Sur cet ordinateur**, sans compte après téléchargement, puis **Explorer les autres options**. La configuration comporte trois étapes : connexion, microphone/raccourci, dictée réelle de test. Une clé acceptée ou un modèle sélectionné ne suffit pas à marquer l’application prête : le test doit produire un résultat. « Configurer plus tard » conserve un état visible à terminer.

Les services principaux apparaissent avant la liste complète. Recherche, filtres français/live, sélection courte de modèles et modèle personnalisé restent accessibles. Les clés enregistrées et les préférences de modèle sont conservées par service. Les adresses avancées doivent être vérifiées lorsqu’elles changent. L’interface principale est disponible en français et anglais ; la langue parlée est indépendante.

Le service de nettoyage IA et la connexion du mode temps réel sont configurés séparément. Un profil local désactive le nettoyage cloud par défaut. Le passage d’un live local à une transcription cloud après un échec est bloqué sans consentement explicite. La capture conserve l’audio complet en mémoire : un débordement du flux live déclenche le chemin de récupération autorisé au lieu d’accepter une transcription tronquée.

## Catalogue livré

Le [catalogue partagé](../src-tauri/catalog/providers.json) comporte 20 entrées : OpenRouter, Mistral, OpenAI, Groq, ElevenLabs, Deepgram, AssemblyAI, Soniox, Gladia, Speechmatics, Gemini, Cohere, Rev AI, Sarvam, Cartesia, Azure Speech, Google Cloud Speech, Amazon Transcribe, serveur local et moteur natif. OpenRouter comprend 25 presets STT et peut découvrir d’autres modèles par son API, avec cache local. Les modèles découverts ne sont pas automatiquement recommandés.

Les contrats OpenAI et les contrats natifs sont distincts : multipart, audio binaire, JSON, upload/polling ou WebSocket selon le service. Les identifiants de jobs sont contrôlés ; le nettoyage distant vise uniquement les jobs/fichiers créés par la demande. Les délais, tentatives et annulations sont bornés. Les coûts absents ne sont plus inventés à partir de la durée : l’historique indique les montants communiqués et les coûts inconnus.

Les dix entrées du [catalogue local](../src-tauri/catalog/local-models.json) couvrent Whisper Tiny/Base/Small/Large v3/Turbo/Turbo Q5, Parakeet v3, Qwen3-ASR 0.6B, Moonshine Tiny et Nemotron streaming. Dictum télécharge, vérifie, installe et charge ces poids. Il gère progression, pause/reprise, contrôle d’espace disque, import vérifié et suppression. Les moteurs sont réutilisés entre les dictées ; le live préchargé ne recharge pas les poids à chaque démarrage.

Voxtral, Qwen 1.7B, Canary, Cohere, Granite et SenseVoice restent accessibles par le parcours serveur compatible, avec leurs propres runtimes. Ils ne sont pas présentés comme des poids installables par le moteur natif actuel. Le [guide local](local-models.md) distingue les formats acceptés, les préréglages Speaches/whisper.cpp/LocalAI/vLLM et les modèles nécessitant un serveur.

## Validation

- Build TypeScript/Vite et tests d’interface, dont connexion directe sans OpenRouter, clé réutilisée au retour, modèle local chargé, raccourcis, quotas, langue et première dictée obligatoire.
- Tests Rust sur les formats audio, la migration des réglages, le consentement cloud, l’historique, les payloads/authentifications HTTP, les jobs asynchrones et les échanges WebSocket. La régression de 75 secondes conserve tous les échantillons.
- Test réel CPU des cinq familles de moteurs sur le fichier public JFK de whisper.cpp : Whisper, Moonshine, Parakeet, Qwen et Nemotron streaming. Le test supplémentaire vérifie l’annulation de Whisper, la disponibilité du worker après annulation et le streaming préchargé.
- Tests de navigation en navigateur à 1120 × 760, en français et anglais : démarrage, préréglage whisper.cpp, réglages, dix cartes locales et noms accessibles des interrupteurs.
- Compilation Windows optimisée et génération des paquets NSIS/MSI, avec les DLL natives et les notices de licence dans les ressources.
- Extraction du MSI final : présence des deux exécutables, des quatre DLL et des six notices vérifiée ; empreintes des DLL comparées aux runtimes attendus. Le CLI extrait du paquet a transcrit le fichier public JFK avec Whisper et Parakeet, sans installation sur le système.

Les appels cloud ont été vérifiés avec leurs documentations et des serveurs de test, sans utiliser de compte payant. Cela ne remplace pas une dictée avec chaque compte, région et niveau d’abonnement réel. Le corpus de référence anglais vérifie l’exécution, pas une précision comparative en français ou un classement de WER. L’accélération GPU, une installation sur un Windows vierge et les essais auprès de débutants nécessitent des environnements distincts ; aucune couverture mondiale chiffrée n’est revendiquée.

## Commandes reproductibles

```powershell
npm run build
npm test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --all-targets
npm run desktop:build
```

Le test réel est opt-in pour ne pas télécharger plusieurs gigaoctets en CI : après installation des cinq modèles dans un dossier de test et récupération du fichier public `samples/jfk.wav`, définir `DICTUM_SMOKE_MODELS` et `DICTUM_SMOKE_WAV`, puis lancer `cargo test --manifest-path src-tauri/Cargo.toml --test native_smoke -- --ignored`. Rust 1.88 est le minimum déclaré ; le chantier a utilisé stable MSVC sur Windows x64. Les DLL ONNX sont placées à côté des exécutables et des tests pour empêcher une autre version installée sur le PC de remplacer l’ABI attendue.
