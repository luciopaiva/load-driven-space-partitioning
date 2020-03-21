
import GrahamScan from "./node_modules/@lucio/graham-scan/graham-scan.mjs";

export default class Snapshot {

    /** @type {Number} */
    numberOfFocuses = 0;
    /** @type {[Number, Number][]} */
    focuses = [];
    /** @type {GrahamScan[]} */
    innerHullVerticesByFocusIndex = [];
    /** @type {GrahamScan[]} */
    outerHullVerticesByFocusIndex = [];
    /** @type {Number[]} */
    loadFactorByFocusIndex = [];
    /** @type {Number} */
    numberOfForwards = 0;
    /** @type {Boolean} */
    isWithinComfortableLFThreshold = false;
    /** @type {Set<Number>[]} */
    ownPlayersByFocusIndex = [];
    /** @type {Set<Number>[]} */
    interestSetByFocusIndex = [];

    constructor (numberOfFocuses) {
        this.numberOfFocuses = numberOfFocuses;

        for (let i = 0; i < this.numberOfFocuses; i++) {
            this.innerHullVerticesByFocusIndex.push(new GrahamScan());
            this.outerHullVerticesByFocusIndex.push(new GrahamScan());
            this.ownPlayersByFocusIndex.push(new Set());
            this.interestSetByFocusIndex.push(new Set());
            this.loadFactorByFocusIndex[i] = 0;
        }
    }

    addPlayerToFocus(playerIndex, playerPosition, focusIndex) {
        this.ownPlayersByFocusIndex[focusIndex].add(playerIndex);

        // update inner hull
        this.innerHullVerticesByFocusIndex[focusIndex].addPoint(playerPosition);
        // the outer hull also needs to contain own clients
        this.outerHullVerticesByFocusIndex[focusIndex].addPoint(playerPosition);
    }

    addExternalPlayerToFocus(playerIndex, playerPosition, focusIndex) {
        this.interestSetByFocusIndex[focusIndex].add(playerIndex);

        this.outerHullVerticesByFocusIndex[focusIndex].addPoint(playerPosition);
    }

    incrementNumberOfForwards(numberOfForwards) {
        this.numberOfForwards += numberOfForwards;
    }

    setFocusLoadFactor(focusIndex, loadFactor) {
        this.loadFactorByFocusIndex[focusIndex] = loadFactor;
    }

    getFocusLoadFactor(focusIndex) {
        return this.loadFactorByFocusIndex[focusIndex];
    }

    getOwnPlayersByFocusIndex(focusIndex) {
        return this.ownPlayersByFocusIndex[focusIndex];
    }

    getExternalInterestSetByFocusIndex(focusIndex) {
        return this.interestSetByFocusIndex[focusIndex];
    }

    getFocuses() {
        return this.focuses;
    }

    obtainInnerHulls() {
        return this.innerHullVerticesByFocusIndex.map(vertices => vertices.getHull());
    }

    obtainOuterHulls() {
        return this.outerHullVerticesByFocusIndex.map(vertices => vertices.getHull());
    }
}
