import {describe, it, expect} from 'vitest';
import {NomDeFichierFreebox} from "./nom-de-fichier-freebox";
import {TriParNom, TriParSerie} from "./tri";
import path from "node:path";

describe("TriParSerie", () => {

    const tri = new TriParSerie("Par série", [
        "Columbo",
    ]);

    it("calculerCheminCible série connue", () => {
        const nomDeFichierParse = NomDeFichierFreebox.from({
            chaine: "TMC",
            milieu: "Columbo (Saison 8 - épisode 4 4 Grandes manoeuvres et petits soldats)",
            nomOriginal: "TMC - Columbo (Saison 8 - épisode 4 4 Grandes manoeuvres et petits soldats) - 11-10-2025 21h00 02h20 (188).m2ts",
            separateur: " - ",
            timestampDureeExtensions: "11-10-2025 21h00 02h20 (188).m2ts",
        })
        const cheminCible = tri.calculerCheminCible(nomDeFichierParse);
        expect(cheminCible).toBe(path.join(
            "Par série",
            "Columbo",
            "Columbo (Saison 8 - épisode 4 4 Grandes manoeuvres et petits soldats) - TMC - 11-10-2025 21h00 02h20 (188).m2ts",
        ));
    });

});

describe("TriParNom", () => {

    const tri = new TriParNom("Par nom");

    it("calculerCheminCible", () => {
        const nomDeFichierParse = NomDeFichierFreebox.from({
            chaine: "6ter",
            milieu: "Jours de tonnerre",
            nomOriginal: "6ter - Jours de tonnerre - 13-05-2025 21h11 02h08 (159).m2ts",
            separateur: " - ",
            timestampDureeExtensions: "13-05-2025 21h11 02h08 (159).m2ts",
        })
        const cheminCible = tri.calculerCheminCible(nomDeFichierParse);
        expect(cheminCible).toBe(path.join(
            "Par nom",
            "Jours de tonnerre - 6ter - 13-05-2025 21h11 02h08 (159).m2ts",
        ));
    });

});
