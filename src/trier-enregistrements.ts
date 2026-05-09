import path from "node:path";
import process from "node:process";
import {NomDeFichierFreebox} from "./nom-de-fichier-freebox";
import {TriParNom, TriParSerie} from "./tri";
import {moveFile, readdir} from "./file-utils";
// FIXME : provoque l'erreur : TypeError: util.promisify(...)(...) is not a function
// const util = require('util')
// const readdir = util.promisify(fs.readdir)

class Tri {
    constructor(
        public readonly deplacementsDeFichier: DeplacementDeFichier[],
    ) {
    }

    async trier(dossier: string): Promise<void> {
        console.log(`📂 Tri des enregistrements du dossier ${dossier}`);

        const entrees = await readdir(dossier)
        console.log(`📋 ${entrees.length} fichier(s) à trier...`, entrees);

        for (const entree of entrees) {
            if (!entree.includes('.')) {
                // On ne traite pas les dossiers
                continue;
            }
            if (!entree.includes('.m2ts')) {
                console.log(`Fichier ignoré : ${entree}`)
                continue;
            }
            const nomDuFichierParse = NomDeFichierFreebox.parseFileName(entree);
            try {
                for (const deplacementDeFichier of this.deplacementsDeFichier) {
                    const fichierDeplace = await deplacementDeFichier.deplacerFichier(dossier, nomDuFichierParse);
                    if (fichierDeplace) {
                        console.log(`Fichier déplacé avec succès`)
                        break
                    }
                }
            } catch (err) {
                console.error('Erreur lors du déplacement', err);
            }
        }

        console.log(`✅  Tri terminé`);
    }

}

abstract class DeplacementDeFichier {
    /**
     * @return Le fichier a été déplacé ?
     */
    abstract deplacerFichier(dossier: string, nomDuFichierParse: NomDeFichierFreebox): Promise<boolean>;
}

class DeplacementParSerie extends DeplacementDeFichier {
    private tri: TriParSerie | undefined;

    constructor(
        readonly dossierCible: string,
    ) {
        super();
    }

    async rechercherNomsDeSeriesConnus(): Promise<string[]> {
        return await readdir(this.dossierCible);
    }

    async deplacerFichier(dossier: string, nomDuFichierParse: NomDeFichierFreebox): Promise<boolean> {
        this.tri ??= new TriParSerie(this.dossierCible, await this.rechercherNomsDeSeriesConnus());
        const cheminCible = this.tri.calculerCheminCible(nomDuFichierParse);
        if (!cheminCible) return false;
        await moveFile(
            path.join(dossier, nomDuFichierParse.nomOriginal),
            cheminCible,
        );
        return true;
    }
}

class DeplacementParNom extends DeplacementDeFichier {
    private tri: TriParNom | undefined;

    constructor(
        readonly dossierCible: string,
    ) {
        super();
    }

    async deplacerFichier(dossier: string, nomDuFichierParse: NomDeFichierFreebox): Promise<boolean> {
        this.tri ??= new TriParNom(this.dossierCible);
        const cheminCible = this.tri.calculerCheminCible(nomDuFichierParse);
        if (!cheminCible) return false;
        await moveFile(
            path.join(dossier, nomDuFichierParse.nomOriginal),
            cheminCible,
        )
        return true;
    }
}

(async function main(argv: string[]): Promise<void> {
    const args = argv.slice(2);
    const [dossier] = args;
    if (!dossier) {
        throw new Error(`Veuillez indiquer le dossier à trier`)
    }

    const tri = new Tri([
        new DeplacementParSerie(path.join(dossier, 'Par série')),
        new DeplacementParNom(path.join(dossier, 'Par nom')),
    ]);
    await tri.trier(dossier)

})(process.argv);
