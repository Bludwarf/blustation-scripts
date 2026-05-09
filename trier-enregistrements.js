/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 517:
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __nccwpck_require__) {

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const path = __nccwpck_require__(928);
const fs = __nccwpck_require__(896);
// FIXME : provoque l'erreur : TypeError: util.promisify(...)(...) is not a function
// const util = require('util')
// const readdir = util.promisify(fs.readdir)
function readdir(dir) {
    return new Promise((resolve, reject) => {
        fs.readdir(dir, (err, files) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(files);
            }
        });
    });
}
function parseFileName(fileName) {
    const separator = ' - ';
    let remaining = fileName;
    const channelEndIndex = fileName.indexOf(separator);
    const channel = fileName.substring(0, channelEndIndex);
    // console.log(channel)
    remaining = remaining.substring(channelEndIndex + separator.length);
    const middleEndIndex = remaining.lastIndexOf(separator);
    const timestampAndDuration = remaining.substring(middleEndIndex + separator.length);
    remaining = remaining.substring(0, middleEndIndex);
    if (!remaining) {
        throw new Error(`timestampAndDuration introuvable pour ${fileName}`);
    }
    // console.log(remaining)
    return {
        nomOriginal: fileName,
        separateur: separator,
        chaine: channel,
        milieu: remaining,
        timestampEtDuree: timestampAndDuration,
    };
}
function moveFile(source, target) {
    console.log('Source :', source);
    console.log('Cible  :', target);
    return new Promise((resolve, reject) => {
        fs.rename(source, target, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}
class Tri {
    constructor(deplacementsDeFichier) {
        this.deplacementsDeFichier = deplacementsDeFichier;
    }
    trier(dossier) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Tri des enregistrements du dossier ${dossier}`);
            const entrees = yield readdir(dossier);
            // console.log(`Fichiers`, entrees);
            for (const entree of entrees) {
                if (!entree.includes('.')) {
                    // On ne traite pas les dossiers
                    continue;
                }
                if (!entree.includes('.m2ts')) {
                    console.log(`Fichier ignoré : ${entree}`);
                    continue;
                }
                const nomDuFichierParse = parseFileName(entree);
                try {
                    for (const deplacementDeFichier of this.deplacementsDeFichier) {
                        const fichierDeplace = yield deplacementDeFichier.deplacerFichier(dossier, nomDuFichierParse);
                        if (fichierDeplace) {
                            console.log(`Fichier déplacé avec succès`);
                            break;
                        }
                    }
                }
                catch (err) {
                    console.error('Erreur lors du déplacement', err);
                }
            }
        });
    }
}
class DeplacementDeFichier {
}
class DeplacementParSerie extends DeplacementDeFichier {
    constructor(dossierCible) {
        super();
        this.dossierCible = dossierCible;
    }
    rechercherNomsDeSeriesConnus() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield readdir(this.dossierCible);
        });
    }
    deplacerFichier(dossier, nomDuFichierParse) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.nomsDeSeriesConnus) !== null && _a !== void 0 ? _a : (this.nomsDeSeriesConnus = yield this.rechercherNomsDeSeriesConnus());
            for (const nomDeSerieConnu of this.nomsDeSeriesConnus) {
                if (nomDuFichierParse.milieu.startsWith(nomDeSerieConnu)) {
                    yield moveFile(path.join(dossier, nomDuFichierParse.nomOriginal), path.join(this.dossierCible, nomDeSerieConnu, nomDuFichierParse.milieu +
                        nomDuFichierParse.separateur +
                        nomDuFichierParse.chaine +
                        nomDuFichierParse.separateur +
                        nomDuFichierParse.timestampEtDuree));
                    return true;
                }
            }
            return false;
        });
    }
}
class DeplacementParNom extends DeplacementDeFichier {
    constructor(dossierCible) {
        super();
        this.dossierCible = dossierCible;
    }
    deplacerFichier(dossier, nomDuFichierParse) {
        return __awaiter(this, void 0, void 0, function* () {
            yield moveFile(path.join(dossier, nomDuFichierParse.nomOriginal), path.join(this.dossierCible, nomDuFichierParse.milieu +
                nomDuFichierParse.separateur +
                nomDuFichierParse.chaine +
                nomDuFichierParse.separateur +
                nomDuFichierParse.timestampEtDuree));
            return true;
        });
    }
}
(function main(argv) {
    return __awaiter(this, void 0, void 0, function* () {
        const args = argv.slice(2);
        const [dossier] = args;
        if (!dossier) {
            throw new Error(`Veuillez indiquer le dossier à trier`);
        }
        const tri = new Tri([
            new DeplacementParSerie(path.join(dossier, 'Par série')),
            new DeplacementParNom(path.join(dossier, 'Par nom')),
        ]);
        yield tri.trier(dossier);
    });
})(process.argv);


/***/ }),

/***/ 896:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ 928:
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(517);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;