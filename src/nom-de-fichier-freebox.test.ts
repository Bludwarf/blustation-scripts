import {describe, it, expect} from 'vitest';
import {NomDeFichierFreebox} from "./nom-de-fichier-freebox";

describe("NomDeFichierFreebox", () => {

    it("parseFileName Jours de tonnerre.m2ts", () => {
        const nomOriginal = "6ter - Jours de tonnerre - 13-05-2025 21h11 02h08 (159).m2ts";
        const nomDeFichierParse = NomDeFichierFreebox.parseFileName(nomOriginal);
        expect(nomDeFichierParse).toStrictEqual(NomDeFichierFreebox.from({
            chaine: "6ter",
            milieu: "Jours de tonnerre",
            nomOriginal: nomOriginal,
            separateur: " - ",
            timestampDureeExtensions: "13-05-2025 21h11 02h08 (159).m2ts",
        }));
    });

    it("parseFileName Jours de tonnerre.m2ts.idx", () => {
        const nomOriginal = "6ter - Jours de tonnerre - 13-05-2025 21h11 02h08 (159).m2ts.idx";
        const nomDeFichierParse = NomDeFichierFreebox.parseFileName(nomOriginal);
        expect(nomDeFichierParse).toStrictEqual(NomDeFichierFreebox.from({
            chaine: "6ter",
            milieu: "Jours de tonnerre",
            nomOriginal: nomOriginal,
            separateur: " - ",
            timestampDureeExtensions: "13-05-2025 21h11 02h08 (159).m2ts.idx",
        }));
    });

    it("parseFileName Meurtres au paradis", () => {
        const nomOriginal = "France 2 - Meurtres au paradis (Saison 1 - épisode 1 8 L'armoire des scellés) - 12-05-2025 23h50 01h30 (158).m2ts";
        const nomDeFichierParse = NomDeFichierFreebox.parseFileName(nomOriginal);
        expect(nomDeFichierParse).toStrictEqual(NomDeFichierFreebox.from({
            chaine: "France 2",
            milieu: "Meurtres au paradis (Saison 1 - épisode 1 8 L'armoire des scellés)",
            nomOriginal: nomOriginal,
            separateur: " - ",
            timestampDureeExtensions: "12-05-2025 23h50 01h30 (158).m2ts",
        }));
    });

    it("parseFileName Columbo S08.E04", () => {
        const nomOriginal = "TMC - Columbo (Saison 8 - épisode 4 4 Grandes manoeuvres et petits soldats) - 11-10-2025 21h00 02h20 (188).m2ts";
        const nomDeFichierParse = NomDeFichierFreebox.parseFileName(nomOriginal);
        expect(nomDeFichierParse).toStrictEqual(NomDeFichierFreebox.from({
            chaine: "TMC",
            milieu: "Columbo (Saison 8 - épisode 4 4 Grandes manoeuvres et petits soldats)",
            nomOriginal: nomOriginal,
            separateur: " - ",
            timestampDureeExtensions: "11-10-2025 21h00 02h20 (188).m2ts",
        }));
    });

    it("parseFileName Columbo S09.E03", () => {
        const nomOriginal = "TMC - Columbo (Saison 9 - épisode 3 6 Votez pour moi) - 10-05-2025 21h00 02h20 (154).m2ts";
        const nomDeFichierParse = NomDeFichierFreebox.parseFileName(nomOriginal);
        expect(nomDeFichierParse).toStrictEqual(NomDeFichierFreebox.from({
            chaine: "TMC",
            milieu: "Columbo (Saison 9 - épisode 3 6 Votez pour moi)",
            nomOriginal: nomOriginal,
            separateur: " - ",
            timestampDureeExtensions: "10-05-2025 21h00 02h20 (154).m2ts",
        }));
    });

    it("parseFileName Columbo (saison inconnue)", () => {
        const nomOriginal = "TMC - Columbo (Couronne mortuaire) - 04-01-2025 21h15 01h50 (77).m2ts";
        const nomDeFichierParse = NomDeFichierFreebox.parseFileName(nomOriginal);
        expect(nomDeFichierParse).toStrictEqual(NomDeFichierFreebox.from({
            chaine: "TMC",
            milieu: "Columbo (Couronne mortuaire)",
            nomOriginal: nomOriginal,
            separateur: " - ",
            timestampDureeExtensions: "04-01-2025 21h15 01h50 (77).m2ts",
        }));
    });
});
