export class NomDeFichierFreebox {

    constructor(
        readonly nomOriginal: string,
        readonly separateur: string,
        readonly chaine: string,
        readonly milieu: string,
        readonly timestampDureeExtensions: string,
    ) {
    }

    static from(json: any): NomDeFichierFreebox {
        return new NomDeFichierFreebox(
            json.nomOriginal,
            json.separateur,
            json.chaine,
            json.milieu,
            json.timestampDureeExtensions,
        )
    }


    static parseFileName(fileName: string): NomDeFichierFreebox {
        const separator = ' - ';

        let remaining = fileName
        const channelEndIndex = fileName.indexOf(separator);
        const channel = fileName.substring(0, channelEndIndex)
        // console.log(channel)
        remaining = remaining.substring(channelEndIndex + separator.length)

        const middleEndIndex = remaining.lastIndexOf(separator);
        const timestampAndDuration = remaining.substring(middleEndIndex + separator.length)
        remaining = remaining.substring(0, middleEndIndex)
        if (!remaining) {
            throw new Error(`timestampAndDuration introuvable pour ${fileName}`)
        }

        // console.log(remaining)

        return NomDeFichierFreebox.from({
            nomOriginal: fileName,
            separateur: separator,
            chaine: channel,
            milieu: remaining,
            timestampDureeExtensions: timestampAndDuration,
        });
    }
}
