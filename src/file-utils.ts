import fs from "node:fs";

export function readdir(dir: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(dir, (err: Error, files: string[]) => {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        })
    })
}

export function moveFile(source: string, target: string): Promise<void> {
    console.log('Source :', source)
    console.log('Cible  :', target)
    return new Promise((resolve, reject) => {
        fs.rename(source, target, (err: Error) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        })
    });
}
