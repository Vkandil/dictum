# Publication GitHub de Dictum 1.4.0

Le code et la préparation de version sont automatisés. Le workflow de livraison refuse les exécutables Windows non signés, conformément à la politique existante du projet dans [releasing.md](releasing.md). Les installateurs locaux de développement ne remplacent pas cette livraison.

## Ce qui manque dans GitHub

Au moment de la préparation, le dépôt possède le secret `TAURI_SIGNING_PRIVATE_KEY`. Aucun secret de signature Authenticode Windows ni variable Azure Artifact Signing n'est configuré. Le contenu de la clé Tauri n'est pas accessible par l'API GitHub : sa présence ne permet pas de vérifier son mot de passe ou sa correspondance avec la clé publique embarquée. Conserver cette clé pour que les installations existantes reconnaissent les futures mises à jour.

La création ou l'achat d'une identité de signature publique et sa vérification d'identité doivent être effectués par le propriétaire du projet. Ne jamais mettre une clé privée ou un certificat dans un commit, une issue ou une conversation.

## Si tu possèdes un certificat de signature exportable PFX

1. Vérifie avec l'émetteur que le certificat est un certificat public de signature de code RSA, valide, avec clé privée exportable. Un certificat TLS ou un certificat auto-signé ne convient pas. Si la clé est conservée sur un token ou un HSM, utilise l'intégration de l'émetteur ; la procédure PFX ne convient pas.
2. Ouvre [Settings → Secrets and variables → Actions](https://github.com/Vkandil/dictum/settings/secrets/actions), puis **New repository secret**.
3. Crée `WINDOWS_CERTIFICATE`. Sa valeur doit être le contenu du fichier PFX encodé en Base64. Par exemple, dans PowerShell sur ton ordinateur :

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\chemin\certificat.pfx')) | Set-Clipboard
   ```

   Colle cette valeur uniquement dans le champ du secret GitHub, enregistre, puis vide le presse-papiers avec `Set-Clipboard -Value ''`.
4. Crée `WINDOWS_CERTIFICATE_PASSWORD` avec le mot de passe du PFX.
5. Si la clé de mise à jour Tauri possède un mot de passe, crée aussi `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` avec ce mot de passe. Si elle n'en possède pas, ce secret est facultatif. Ne remplace pas la clé de mise à jour existante.

## Si tu utilises Azure Artifact Signing

1. Crée ou sélectionne ton compte et ton profil de certificat public dans Azure, après vérification de ton éligibilité et de ton identité selon la [documentation Microsoft](https://learn.microsoft.com/azure/artifact-signing/faq).
2. Crée un principal de service et accorde-lui le rôle **Artifact Signing Certificate Profile Signer** sur le profil concerné.
3. Dans les [secrets Actions](https://github.com/Vkandil/dictum/settings/secrets/actions), ajoute `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` et `AZURE_TENANT_ID`.
4. Dans les [variables Actions](https://github.com/Vkandil/dictum/settings/variables/actions), ajoute `ARTIFACT_SIGNING_ENDPOINT`, `ARTIFACT_SIGNING_ACCOUNT` et `ARTIFACT_SIGNING_PROFILE`, avec les valeurs exactes de ton compte Azure. Le workflow donne priorité à cette configuration lorsqu'elle est complète.
5. Vérifie aussi le mot de passe éventuel de la clé Tauri, comme indiqué ci-dessus.

Une intégration d'un autre émetteur nécessite une adaptation du workflow. Le projet documente aussi la piste [SignPath Foundation](https://signpath.org/) ; une acceptation du projet et une intégration spécifique sont nécessaires.

## Construire et publier lorsque la signature est prête

1. Vérifie que le dernier [Windows CI](https://github.com/Vkandil/dictum/actions/workflows/ci.yml) sur `main` est vert, pour les tests et l'audit de dépendances.
2. Ouvre [Windows Release](https://github.com/Vkandil/dictum/actions/workflows/release.yml), clique **Run workflow**, choisis `main`, puis lance. Aucun nouveau tag manuel n'est nécessaire : l'action utilise la version `1.4.0` et complète le brouillon `v1.4.0`.
3. Attends le succès du workflow. En cas d'échec de signature, ouvre l'étape en échec et corrige les secrets correspondants. Ne supprime pas les vérifications de signature pour contourner le problème.
4. Dans les [releases](https://github.com/Vkandil/dictum/releases), ouvre le brouillon **Dictum v1.4.0 for Windows**. Vérifie la présence des installateurs NSIS et MSI signés, des fichiers de mise à jour Tauri et de `SHA256SUMS.txt`. Le brouillon préparé sans signature ne contient pas encore ces fichiers.
5. Télécharge et teste les paquets sur des Windows 10 et Windows 11 vierges selon la [checklist](windows-release-checklist.md). Vérifie aussi la mise à jour depuis la version précédente, le microphone, les raccourcis, une dictée de 75 secondes, le téléchargement d'un modèle local et le mode live. Les comptes cloud réels et le GPU restent des validations distinctes.
6. Suis les étapes de soumission Microsoft décrites dans [releasing.md](releasing.md), puis ouvre le brouillon, retire la mention de préparation et clique **Publish release** lorsque les contrôles sont terminés.

Les commandes et les secrets ne remplacent pas les essais sur une machine vierge. Les validations déjà réalisées et leurs limites sont consignées dans le [bilan d'intégration](provider-implementation.fr.md).
