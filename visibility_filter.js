class TargetPlanner {
    constructor(aperture, focal, eyepiece, bortle) {
        this.aperture = aperture; // ex: 150 mm
        this.focal = focal;       // ex: 1200 mm
        this.eyepiece = eyepiece; // ex: 25 mm
        this.bortle = bortle;     // ex: 4

        // Grossissement et Pupille de sortie
        this.magnification = this.focal / this.eyepiece; // 48x
        this.exitPupil = this.aperture / this.magnification; // 3.125 mm

        // Estimation de la magnitude limite visuelle à l'œil nu selon Bortle (NELM)
        const nelmTable = { 1: 7.8, 2: 7.3, 3: 6.8, 4: 6.3, 5: 5.8, 6: 5.3, 7: 4.8, 8: 4.3, 9: 3.8 };
        this.nelm = nelmTable[bortle] || 6.0;

        // Estimation de la brillance de fond du ciel (mag/arcsec²)
        const skySurfMagTable = { 1: 22.0, 2: 21.7, 3: 21.3, 4: 20.8, 5: 20.1, 6: 19.3, 7: 18.5, 8: 17.8, 9: 17.0 };
        this.skySurfMag = skySurfMagTable[bortle] || 20.0;

        // Magnitude limite instrumentale théorique
        this.instrumentalMagLimit = this.nelm + 5 * Math.log10(this.aperture / 6.0);
    }

    calculateAltitude(raDeg, decDeg, lat, lon) {
        const now = new Date();
        // Calcul simplifié de la hauteur
        const d = (now.getTime() / 86400000) - 10957.5;
        const lst = (280.46061837 + 360.98564736629 * d + lon) % 360;
        const ha = ((lst - raDeg) + 360) % 360;
        
        const haRad = ha * Math.PI / 180;
        const decRad = decDeg * Math.PI / 180;
        const latRad = lat * Math.PI / 180;

        const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
        return Math.asin(sinAlt) * 180 / Math.PI;
    }

    filterTargets(targets, lat, lon, minAlt) {
        return targets.filter(target => {
            // 1. Hauteur au-dessus de l'horizon
            const alt = this.calculateAltitude(target.ra, target.dec, lat, lon);
            if (alt < minAlt) return false;

            // 2. Magnitude limite globale
            if (target.mag > this.instrumentalMagLimit) return false;

            // 3. Taille minimale perçue à l'oculaire (min 10 arcmin apparents pour l'œil)
            const apparentSize = target.size_maj * this.magnification;
            if (apparentSize < 10.0 && target.type !== 'cluster') return false;

            // 4. Seuil de brillance surfacique vs ciel (pour objets étendus)
            if (target.surfMag && target.type !== 'cluster') {
                // Si l'objet est plus sombre que le ciel + 2.5 mag, il est invisible en visuel
                if (target.surfMag > (this.skySurfMag + 2.5)) return false;
            }

            return true;
        });
    }
}