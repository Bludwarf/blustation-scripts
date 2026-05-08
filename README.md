# cut-m2ts.ts

## Installation

Installer ffmpeg sur BluStation :

1. Centre de paquets > Paramètres > Sources de paquet > Ajouter : http://packages.synocommunity.com/
2. Installer ffmpeg (par exemple la version 7) => vérifier l'install dans `/var/packages/ffmpeg7/`

L'installation globale de `npm install -g ts-node typescript` pose des problèmes, on fait donc tout dans le dossier des scripts.

```shell
cd "/volume1/Logiciels/Synology/Scripts"
npm install
```

## Utilisation

```shell
cd "/volume1/Logiciels/Synology/Scripts"
npm run cut -- "/volume1/video/Enregistrements/TMC - Madame est servie (Tony fait du golf) - 08-05-2026 10h50 05m (199).m2ts" --ffmpeg-path "/var/packages/ffmpeg7/target/bin/ffmpeg"
```
