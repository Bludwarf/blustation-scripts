import {NomDeFichierFreebox} from "./nom-de-fichier-freebox";
import path from "node:path";

export abstract class Tri {

    constructor(
        readonly dossierCible: string,
    ) {
    }

    calculerCheminCible(nomDuFichierParse: NomDeFichierFreebox): string | undefined {
        const cheminCibleRelatif = this.calculerCheminCibleRelatif(nomDuFichierParse);
        if (!cheminCibleRelatif) return undefined;
        return path.join(this.dossierCible, cheminCibleRelatif);
    }

    abstract calculerCheminCibleRelatif(nomDuFichierParse: NomDeFichierFreebox): string | undefined;
}

export class TriParSerie extends Tri {

    constructor(
        readonly dossierCible: string,
        readonly nomsDeSeriesConnus: string[],
    ) {
        super(dossierCible);
    }

    calculerCheminCibleRelatif(nomDuFichierParse: NomDeFichierFreebox): string | undefined {
        for (const nomDeSerieConnu of this.nomsDeSeriesConnus) {
            if (nomDuFichierParse.milieu.startsWith(nomDeSerieConnu)) {
                return path.join(nomDeSerieConnu,
                    nomDuFichierParse.milieu +
                    nomDuFichierParse.separateur +
                    nomDuFichierParse.chaine +
                    nomDuFichierParse.separateur +
                    nomDuFichierParse.timestampDureeExtensions);
            }
        }
    }
}

export class TriParNom extends Tri {
    calculerCheminCibleRelatif(nomDuFichierParse: NomDeFichierFreebox): string {
        return nomDuFichierParse.milieu +
            nomDuFichierParse.separateur +
            nomDuFichierParse.chaine +
            nomDuFichierParse.separateur +
            nomDuFichierParse.timestampDureeExtensions;
    }
}
