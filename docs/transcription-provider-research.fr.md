# Providers et modèles de transcription pour Dictum

Recherche du 14 octobre 2026. Inspection du code du dépôt et consultation de documentations officielles, de fiches de modèles et des catalogues publics OpenRouter et Hugging Face. Aucun appel de transcription payant ni essai de performance locale n'a été effectué. Les compatibilités proposées sont des conclusions tirées du code et des contrats d'API, à valider par un essai audio.

> Cet audit décrit le dépôt avant l’intégration. Pour le catalogue et les fonctions livrées, voir [le bilan d’implémentation](provider-implementation.fr.md).

## Ce que Dictum proposait avant cette intégration

Les providers intégrés sont définis dans [store.rs](../src-tauri/src/store.rs), fonction `builtin_providers`, et repris dans [defaults.ts](../src/lib/defaults.ts).

| Provider | Modèles proposés dans le catalogue intégré | Transport |
| --- | --- | --- |
| OpenRouter | `mistralai/voxtral-mini-transcribe`, `mistralai/voxtral-small-24b-2507` | JSON avec audio WAV en base64 pour le premier ; chat multimodal pour Voxtral Small |
| Mistral | `voxtral-mini-latest`, `voxtral-mini-transcribe-realtime-2602` | Upload multipart ; WebSocket Mistral pour le temps réel |
| Local / vLLM | `mistralai/Voxtral-Mini-3B-2507` | Serveur HTTP compatible OpenAI ; transport WebSocket compatible vLLM prévu |

Le provider par défaut est OpenRouter avec Voxtral Mini Transcribe. Le nom « Local / vLLM » ne signifie pas que vLLM est installé ou indispensable : c'est un client HTTP pour un serveur externe. Le drapeau `supportsRealtime` ne garantit pas que chaque modèle du provider accepte le streaming.

Les réglages avancés acceptent un nom de modèle libre, via « Custom ». Un formulaire permet aussi d'ajouter un provider compatible OpenAI. Il impose `/audio/transcriptions`, `/chat/completions`, une clé API et désactive le temps réel ; le manifeste expose davantage de réglages, mais aucun adaptateur de protocole arbitraire. Voir [Settings.tsx](../src/routes/Settings.tsx) et [generic.rs](../src-tauri/src/transcribe/generic.rs).

Le client générique envoie un WAV, `model`, éventuellement `language` et un contexte lexical, puis attend un JSON contenant `text`. L'authentification est Bearer et la validation de clé appelle `/models`. Un service proposant seulement un autre format d'upload, d'authentification ou de réponse ne devient donc pas compatible en ajoutant son URL.

Dictum ne télécharge pas les poids, ne charge pas un fichier de modèle et ne démarre pas de moteur local. Cela est explicitement documenté dans le [README](../README.md).

## Les modèles absents du menu mais déjà raccordables via OpenRouter

Le catalogue STT OpenRouter contient **25 entrées** au moment de la recherche. Une seule figure dans le menu STT de Dictum : `mistralai/voxtral-mini-transcribe`. L'autre entrée OpenRouter de Dictum est un modèle de chat audio, avec un identifiant différent du modèle STT actuel.

Les 24 entrées suivantes sont absentes du menu. Pour la plupart, le contrat JSON correspond déjà à celui utilisé par Dictum : choisir OpenRouter et renseigner le slug dans le champ Custom devrait permettre une transcription simple, sous réserve des droits du compte, du routage et de la politique ZDR. Cette compatibilité est déduite des contrats, pas testée par une transcription.

| Famille / modèle | Slug OpenRouter à proposer |
| --- | --- |
| Microsoft MAI-Transcribe 2 | `microsoft/mai-transcribe-2` |
| Microsoft MAI-Transcribe 1.5 | `microsoft/mai-transcribe-1.5` |
| Whisper Large v3 Turbo | `openai/whisper-large-v3-turbo` |
| Whisper Large v3 | `openai/whisper-large-v3` |
| Whisper API | `openai/whisper-1` |
| GPT Transcribe | `openai/gpt-transcribe` |
| GPT-4o Transcribe | `openai/gpt-4o-transcribe` |
| GPT-4o Mini Transcribe | `openai/gpt-4o-mini-transcribe` |
| ElevenLabs Scribe v2 | `elevenlabs/scribe-v2` |
| ElevenLabs Scribe v2 Medical | `elevenlabs/scribe-v2-medical` |
| Deepgram Nova-3 | `deepgram/nova-3` |
| AssemblyAI Universal-3.5 Pro | `assemblyai/universal-3-5-pro` |
| Qwen3-ASR 0.6B | `qwen/qwen3-asr-0.6b` |
| Qwen3-ASR 1.7B | `qwen/qwen3-asr-1.7b` |
| NVIDIA Parakeet TDT 0.6B v3 | `nvidia/parakeet-tdt-0.6b-v3` |
| NVIDIA Nemotron 3.5 ASR | `nvidia/nemotron-3.5-asr-streaming-multilingual-0.6b` |
| Google Gemini 3.5 Transcribe | `google/gemini-3.5-transcribe` |
| Google Chirp 3 | `google/chirp-3` |
| Grok STT 1.0 | `x-ai/grok-stt-1.0` |
| Meta Muse Voice Transcribe 1.0 | `meta/muse-voice-transcribe-1.0` |
| Fish Audio Transcribe 1 | `fish-audio/transcribe-1` |
| Fish Audio Transcribe 1 Pro | `fish-audio/transcribe-1-pro` |
| Voxtral Mini 3B STT | `mistralai/voxtral-mini-3b-2507` |
| Voxtral Small 24B STT | `mistralai/voxtral-small-24b-2507-stt` |

Source des identifiants : [API publique du catalogue STT](https://openrouter.ai/api/v1/models?output_modalities=transcription), interrogée pendant la recherche. Le mécanisme de découverte et le contrat sont décrits dans la [documentation STT OpenRouter](https://openrouter.ai/docs/guides/overview/multimodal/stt).

**Exception dans le code :** tout nom contenant `voxtral-small` déclenche aujourd'hui la branche chat multimodal. Le nouveau slug STT Voxtral Small nécessite donc de revoir cette sélection avant de le considérer raccordable par simple configuration.

Le catalogue distant devrait être découvert avec `GET /models?output_modalities=transcription`. Un appel sans filtre ne suffit pas à inventorier les modèles STT. Les modèles généraux comprenant de l'audio ne sont pas tous utilisables sur `/audio/transcriptions`.

## Les plus utilisés : ce que les données permettent de dire

Il n'existe pas de décompte public comparable des utilisateurs de tous les providers. Deux indicateurs sont utiles : le volume STT observé par OpenRouter et les téléchargements de modèles sur Hugging Face. Ils mesurent des usages différents et ne constituent pas un classement de qualité.

Le classement OpenRouter, fondé sur les caractères transcrits pendant les sept derniers jours, place en tête **MAI-Transcribe 2, Whisper Large v3 Turbo et Scribe v2**, puis Whisper Large v3, Qwen3-ASR 0.6B et GPT-4o Mini Transcribe. Voxtral Mini Transcribe, déjà proposé par Dictum, apparaît aussi dans le classement. Source : [classement OpenRouter](https://openrouter.ai/collections/speech-to-text-models).

Pour le local, les compteurs de téléchargements Hugging Face relevés sont notamment d'environ 6,34 millions pour Whisper Large v3 Turbo, 3,69 millions pour Whisper Large v3, 1,97 million pour Voxtral Realtime 4B, 1,11 million pour Qwen3-ASR 1.7B et 622 000 pour Parakeet v3. Ces compteurs sont des indicateurs de diffusion, pas des utilisateurs uniques ; les conversions d'un même modèle ont aussi leurs propres compteurs. Voir les fiches officielles liées dans le tableau local et la [méthode de comptage Hugging Face](https://huggingface.co/docs/hub/models-download-stats).

## Providers directs et modèles supplémentaires à envisager

Une intégration directe permet d'utiliser la clé du fournisseur et d'exploiter son streaming ou ses options propres. L'existence d'un modèle sur OpenRouter n'ajoute pas automatiquement ces fonctions à Dictum.

| Provider direct | Modèles / services à considérer | Travail nécessaire dans Dictum |
| --- | --- | --- |
| [OpenAI](https://developers.openai.com/api/docs/guides/transcription) | `gpt-transcribe`, `gpt-live-transcribe`, GPT-4o Transcribe, Mini, Diarize, `whisper-1` | Les anciens modèles de fichier conviennent au client multipart. Les nouveaux utilisent `languages` ; adapter ces paramètres. Implémenter le transport live et les sorties diarizées. |
| [Groq](https://console.groq.com/docs/speech-to-text) | `whisper-large-v3`, `whisper-large-v3-turbo` | Provider personnalisé compatible pour le batch, base URL `https://api.groq.com/openai/v1` ; ajouter un preset officiel. |
| [Deepgram](https://developers.deepgram.com/docs/models-languages-overview) | Nova-3, Nova-2 ; Flux anglais et multilingue pour le live | Adaptateur REST/WebSocket, auth et extraction du transcript ; Nova-3 est déjà exposé via OpenRouter. |
| [ElevenLabs](https://elevenlabs.io/docs/overview/capabilities/speech-to-text) | Scribe v2 et Scribe v2 Realtime | Adaptateur pour champs propres et `xi-api-key` ; WebSocket pour le live. |
| [AssemblyAI](https://www.assemblyai.com/docs/pre-recorded-audio/select-the-speech-model) | Universal-3.5 Pro, Universal-2 ; [Universal-3 Pro Streaming et Universal-Streaming](https://www.assemblyai.com/docs/faq/language-support-for-real-time-transcription) | Adapter les API Sync, upload/job ou streaming selon l'usage, ainsi que l'authentification et les paramètres. |
| [Soniox](https://soniox.com/docs/api-reference/stt/get_models) | `stt-async-v4`, `stt-rt-v4` | Adaptateur async avec upload/job et WebSocket propre pour le live. |
| [Gladia](https://www.gladia.io/blog/solaria-3-speech-to-text-model-for-european-languages) | Solaria-3, autres variantes Solaria selon le mode | Adaptateur REST et live ; candidat à évaluer pour les langues européennes. |
| [Speechmatics](https://docs.speechmatics.com/speech-to-text/batch/quickstart) | Enhanced ; modèles spécialisés selon le domaine | Adapter jobs batch ou protocole realtime et dictionnaire personnalisé. |
| [Google Cloud](https://docs.cloud.google.com/speech-to-text/v2/docs/chirp-model) | Chirp 3 | Adaptateur Speech-to-Text V2, authentification et région cloud. |
| [Google Gemini](https://ai.google.dev/gemini-api/docs/transcribe) | Gemini 3.5 Transcribe et sa variante live | Adaptateur Gemini ; le modèle de fichier est aussi présent sur OpenRouter. |
| [Microsoft Azure](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/rest-speech-to-text) | Speech to Text, Fast Transcription, Custom Speech ; MAI via les offres qui l'exposent | Adaptateur pour endpoint, version, clé/région et réponse Azure. |
| [AWS](https://docs.aws.amazon.com/transcribe/latest/dg/how-input.html) | Amazon Transcribe batch et streaming | Authentification/signature AWS ; S3/jobs pour le batch ou streaming dédié. |
| [Rev AI](https://docs.rev.ai/api/asynchronous/get-started) | Transcription asynchrone et streaming | Adaptateur de jobs, réponses et streaming. |
| [Cartesia](https://docs.cartesia.ai/build-with-cartesia/stt/latest) | Ink 2, dont français | Adaptateur streaming et événements de tour de parole. |
| [Cohere](https://docs.cohere.com/v2/docs/transcribe) | `cohere-transcribe-03-2026` | Vérifier et adapter le contrat Audio Transcriptions ; modèle également téléchargeable. |
| [Sarvam](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/overview) | Saaras v4, v3 | Adaptateur dédié ; pertinent si Dictum cible les langues indiennes. |

Mistral ne doit pas être compté comme provider manquant. **Voxtral Mini Transcribe 2**, identifiant `voxtral-mini-2602`, peut être explicitement proposé en complément de l'alias déjà présent. La variante live `voxtral-mini-transcribe-realtime-2602` est déjà configurée dans Dictum. Le modèle batch commercial et les poids ouverts du modèle realtime sont des distributions distinctes. Source : [documentation audio Mistral](https://docs.mistral.ai/studio/audio/overview).

## Modèles téléchargeables sur un PC

Le catalogue ci-dessous privilégie les principales familles utilisables pour de la dictée. Les poids et le logiciel d'exécution ont parfois des licences distinctes. La licence indiquée est celle du modèle identifié, sans supposer qu'elle s'applique à toutes ses variantes.

| Famille et téléchargement | Français | Licence annoncée | Intérêt et raccordement |
| --- | --- | --- | --- |
| [Whisper](https://github.com/openai/whisper) : tiny, base, small, medium, large-v1/v2/v3, large-v3-turbo | Oui pour les variantes multilingues ; `.en` est anglais | MIT | Première famille à intégrer. CPU/GPU via whisper.cpp ou faster-whisper. Serveur compatible requis aujourd'hui. |
| [Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) | Oui ; 25 langues | CC-BY-4.0 | Modèle compact avec ponctuation et timestamps. Runtime NeMo/Transformers ou conversion compatible ; serveur/passerelle ou intégration native. La v2 est anglaise. |
| [Qwen3-ASR 0.6B](https://huggingface.co/Qwen/Qwen3-ASR-0.6B) et [1.7B](https://huggingface.co/Qwen/Qwen3-ASR-1.7B) | Oui ; 30 langues et 22 dialectes chinois | Apache-2.0 | Bon candidat multilingue. Deux tailles ; batch et streaming selon runtime. Vérifier le contrat du serveur avant de le brancher. |
| [Voxtral Realtime 4B](https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602) | Oui | Apache-2.0 | Poids de la famille realtime déjà prise en charge côté Mistral cloud. Manquent le preset local, l'installation et la gestion du runtime. |
| [Canary 1B v2](https://huggingface.co/nvidia/canary-1b-v2) | Oui ; 25 langues | CC-BY-4.0 | ASR et traduction ; runtime/passerelle à connecter. [Canary-Qwen 2.5B](https://huggingface.co/nvidia/canary-qwen-2.5b) est principalement destiné à l'anglais et a plusieurs licences de composants. |
| [Cohere Transcribe 2B](https://huggingface.co/CohereLabs/cohere-transcribe-03-2026) | Oui ; 14 langues | Apache-2.0 ; consulter aussi les conditions publiées | ASR dédié ; modèle téléchargé et exécuté localement, avec endpoint compatible ou adaptateur. |
| [IBM Granite Speech 4.1 2B](https://huggingface.co/ibm-granite/granite-speech-4.1-2b), Plus et NAR | Oui ; 6 langues pour la variante standard | Apache-2.0 | Vocabulaire spécialisé, ponctuation ; Plus ajoute locuteurs/timestamps, NAR vise la vitesse. Serveur/passerelle à vérifier. |
| [Nemotron 3.5 ASR Streaming 0.6B](https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b) | Oui | OpenMDW-1.1 | Candidat streaming local ; options NeMo, Transformers et runtime C++. Les niveaux de prise en charge varient selon langue/locale. |
| [Vosk](https://alphacephei.com/vosk/models), notamment `vosk-model-small-fr-0.22` | Oui, modèle spécifique | Apache-2.0 pour ce modèle ; d'autres licences existent | Léger et adapté au CPU. Nécessite une intégration Vosk ou une passerelle. Le petit modèle français pèse environ 41 Mo. |
| [Moonshine](https://github.com/moonshine-ai/moonshine) / Moonshine Voice | Selon le modèle exact ; français non établi ici | MIT pour les modèles couverts par cette licence ; anciens modèles non anglais avec exceptions | Famille conçue pour l'exécution sur appareil et le streaming ; intéressante pour les machines modestes. Vérifier langue et poids exacts. |
| [Distil-Whisper large-v3 / v3.5](https://huggingface.co/distil-whisper/distil-large-v3.5) | Non pour ces modèles officiels anglais | MIT | Alternative rapide pour la dictée anglaise ; ne pas en faire le preset français. |
| [Microsoft VibeVoice-ASR](https://huggingface.co/microsoft/VibeVoice-ASR) | Oui | MIT | Transcription avec locuteurs et timestamps ; davantage orienté enregistrements longs que petites dictées sur CPU. Runtime/passerelle à ajouter. |
| [Meta Omnilingual ASR](https://huggingface.co/facebook/omniASR-LLM-1B), variantes CTC et LLM | Oui ; couverture très large | Apache-2.0 | Langues rares et couverture internationale. Privilégier une variante ASR, pas un encodeur W2V sans décodeur. |
| [SenseVoiceSmall](https://huggingface.co/FunAudioLLM/SenseVoiceSmall), [FunASR](https://github.com/modelscope/FunASR), Paraformer et variantes Nano | Dépend du modèle ; SenseVoiceSmall ne liste pas le français | Licence propre aux poids ; MIT du toolkit ≠ licence des modèles | Options pour langues asiatiques et autres marchés. Ne pas généraliser les capacités d'un modèle à toute la famille. |

Les familles wav2vec2/XLS-R, MMS, Zipformer et les fine-tunes spécialisés restent utiles pour une langue ou un domaine précis, mais leur sélection et la ponctuation demandent souvent davantage de configuration. [sherpa-onnx](https://k2-fsa.github.io/sherpa/onnx/) fournit un catalogue de moteurs et de modèles pouvant faciliter une intégration native, dont sous Windows.

Cette liste couvre les principales familles identifiées et des alternatives spécialisées ; elle ne prétend pas énumérer chaque fine-tune, quantification ou modèle par langue.

## Donner accès à un modèle local à Dictum

Aujourd'hui, le chemin est : **poids téléchargés → moteur d'inférence → serveur HTTP → Dictum**. Donner à Dictum un chemin `.bin`, `.gguf`, `.onnx` ou `.safetensors` ne suffit pas.

Le chemin le plus proche du client existant est Whisper exécuté par **faster-whisper derrière [Speaches](https://speaches.ai/usage/speech-to-text/)**. Speaches expose `/v1/audio/transcriptions`, propose le téléchargement de modèles et utilise par exemple `Systran/faster-whisper-small`.

Après installation du serveur et téléchargement du modèle, configurer Dictum :

```text
Provider : Local / vLLM
Adresse  : http://localhost:8000/v1
Modèle   : Systran/faster-whisper-small
Langue   : fr, ou auto
Mode     : transcription après l'enregistrement pour le premier essai
```

L'adresse et le nom doivent correspondre à la configuration effective du serveur. Un modèle converti faster-whisper ne porte pas nécessairement le même nom que les poids Transformers d'origine. Le streaming d'un serveur n'est pas garanti compatible avec le protocole realtime actuel de Dictum.

**whisper.cpp** est particulièrement intéressant pour Windows et le CPU. Son serveur expose par défaut `/inference`, pas l'endpoint attendu par Dictum : adapter le chemin et vérifier les champs, ou fournir une passerelle. Sources : [moteur](https://github.com/ggml-org/whisper.cpp) et [serveur](https://github.com/ggml-org/whisper.cpp/blob/master/examples/server/README.md).

**vLLM** convient à certains modèles sur une machine équipée, mais n'est pas officiellement natif Windows : la documentation indique Linux/WSL. Il ne devrait donc pas être le seul parcours local proposé dans l'interface. Source : [installation vLLM](https://docs.vllm.ai/en/v0.28.0/getting_started/installation/gpu/).

Pour un premier catalogue PC, proposer des profils CPU avec Whisper base/small et Vosk ; des profils GPU avec Whisper Turbo, Parakeet et Qwen3-ASR ; un profil live avec Voxtral Realtime ou Nemotron. Il s'agit d'une priorisation produit à mesurer sur le matériel cible, pas d'une garantie de vitesse.

Le nettoyage IA appelle aujourd'hui `/chat/completions` chez le même provider. Un serveur ASR seul ne le fournit pas nécessairement ; Dictum retombe sur le texte brut si le nettoyage échoue. Pour un usage entièrement local, désactiver ce nettoyage pendant les premiers essais, ou disposer également d'un modèle de texte local derrière une passerelle. À terme, séparer le provider ASR du provider de nettoyage.

## Ordre d'intégration proposé

1. **Actualiser le catalogue OpenRouter** : découverte STT, presets des modèles les plus utilisés, distinction claire des modèles de chat audio. Corriger la sélection par sous-chaîne `voxtral-small`.
2. **Ajouter OpenAI et Groq comme presets directs**, avec capacités et paramètres par modèle ; l'effort est limité pour le batch déjà compatible.
3. **Rendre le local accessible depuis Dictum** : catalogue, téléchargement, choix CPU/GPU, lancement du moteur, sélection du modèle et diagnostic. Commencer par Whisper via whisper.cpp et/ou faster-whisper, puis Parakeet et Qwen3-ASR.
4. **Étendre le live** : adaptateurs Deepgram, ElevenLabs, Soniox et moteurs locaux Voxtral/Nemotron selon les besoins réels de dictée.
5. **Ajouter les providers spécialisés ou entreprise** : AssemblyAI, Gladia, Speechmatics, Google, Azure et AWS selon demande.

Les métadonnées de modèles devraient distinguer batch/live, langues, licence, matériel, vocabulaire personnalisé et sortie structurée. Le booléen realtime au niveau provider ne suffit pas.

Deux autres limites sont à traiter : le dictionnaire OpenRouter requiert des options propres au provider alors que Dictum envoie aujourd'hui un simple `prompt`, et la structure `Transcript` ne conserve pas les locuteurs ni les timestamps. Le découpage audio d'environ 25 secondes, lancé en parallèle, doit aussi respecter les limites de concurrence d'un moteur PC. Ces conclusions proviennent de [generic.rs](../src-tauri/src/transcribe/generic.rs), [mod.rs](../src-tauri/src/transcribe/mod.rs), [audio.rs](../src-tauri/src/audio.rs) et [commands.rs](../src-tauri/src/commands.rs).

Pour valider les choix, utiliser le même petit corpus de dictée : français et anglais, accents, noms propres, chiffres, silences, bruit et changement de langue. Mesurer la fidélité du texte, le délai après arrêt, la mémoire, les hallucinations sur silence et, pour le live, les corrections de texte partiel. Aucun classement fournisseur ne remplace ces mesures sur Dictum.
