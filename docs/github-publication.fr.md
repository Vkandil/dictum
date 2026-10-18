# Publier Dictum sur GitHub

Un certificat Windows et SignPath ne sont pas nécessaires pour cette livraison. Le workflow produit des installateurs sans signature éditeur Authenticode et conserve la signature cryptographique Tauri des mises à jour. Windows peut afficher un avertissement ou bloquer ces installateurs selon sa politique.

## Pour cette version

Le dépôt contient la version 1.4.0, le catalogue des providers et les dix modèles locaux gérés. Les poids des modèles sont téléchargés depuis Dictum après installation ; ils ne sont pas inclus dans les installateurs. Le [guide local](local-models.md) décrit les moteurs et les besoins matériels.

## Les clics dans GitHub

1. Ouvre [Windows CI](https://github.com/Vkandil/dictum/actions/workflows/ci.yml) et vérifie que les tests et l'audit du commit à publier sont verts.
2. Ouvre [Windows Release](https://github.com/Vkandil/dictum/actions/workflows/release.yml), clique **Run workflow**, choisis **main**, puis lance. Si les installateurs sont déjà présents dans le brouillon et que ce build est vert, passe à l'étape suivante.
3. Attends le succès du workflow. Sans certificat configuré, le résumé doit annoncer le mode **unsigned**. La clé Tauri existante reste obligatoire ; aucun secret de certificat Windows n'est à créer.
4. Ouvre les [releases](https://github.com/Vkandil/dictum/releases) puis le brouillon **Dictum v1.4.0 for Windows**. Vérifie que les fichiers suivants sont présents :
   - `Dictum_1.4.0_x64-setup.exe` : installateur recommandé ;
   - `Dictum_1.4.0_x64_en-US.msi` : alternative MSI ;
   - les deux fichiers `.sig`, `latest.json` et `SHA256SUMS.txt`.
5. Télécharge l'EXE, vérifie son empreinte et teste l'installation, le lancement, une dictée et un modèle local. La [checklist Windows](windows-release-checklist.md) détaille les essais sur machines vierges. Garde les limites non vérifiées visibles dans les notes.
6. Dans le brouillon, garde les notes qui présentent les nouveaux modèles et l'absence de signature éditeur Windows. Pour une version stable, laisse **Set as a pre-release** décoché, choisis **Set as the latest release** si proposé, puis clique **Publish release**.
7. Vérifie que [la dernière version publique](https://github.com/Vkandil/dictum/releases/latest) est bien la 1.4.0 et que le bouton de téléchargement du README y conduit.

## Ce qui doit rester en place

Conserve `TAURI_SIGNING_PRIVATE_KEY` et son éventuel mot de passe dans les secrets Actions. Ne remplace pas cette clé pour une nouvelle version : les installations existantes s'en servent pour vérifier les mises à jour. La clé Tauri est distincte d'un certificat reconnu par Windows.

Les avertissements de réputation Windows ne doivent pas être confondus avec une détection antivirus nommée. Ne désactive pas Defender pour lancer Dictum ; voir [le guide Windows](windows-defender.md).

## Pour les versions suivantes

Incrémente la version de façon cohérente dans npm, Cargo, Tauri et les deux lockfiles, mets à jour les notes de version, pousse sur `main`, puis répète les étapes. Ne remplace pas silencieusement les installateurs d'une version publique existante. Une signature Authenticode pourra être ajoutée ultérieurement sans changer la clé de mise à jour Tauri.
