
import GrahamScan from "./node_modules/@lucio/graham-scan/graham-scan.mjs";
import GridSpatialIndex from "./grid-spatial-index.js";
import BoundingBox from "./bounding-box.js";
import {euclideanDistanceSquared} from "./utils.js";

/**
 * This dictates the size of the spatial index cell size. Bigger cells mean more players to iterate through, smaller
 * ones mean more cells to look. The sweet spot here was empirically determined to be 2**13, but it may be different
 * for different input sets.
 */
const SPATIAL_INDEX_CELL_EXPONENT = 13;  // cell side of approx. 82 meters (8192 cm)
const X = 0;
const Y = 1;
const NEIGHBOR_COUNT = 100;

export default class Partitioner {

    /** @type {Number} */
    numberOfFocuses = 1;
    /** @type {Number} */
    numberOfRuns = 0;
    /** @type {Number} */
    totalElapsedTime = 0;

    /** @type {[Number, Number][]} */
    playerPositions = [];
    /** @type {Map<Number, Number[]>} */
    neighborsByPlayerIndex = new Map();
    /** @type {[Number, Number][]} */
    focuses = [];
    /** @type {GrahamScan[]} */
    innerHullVerticesByFocusIndex = [];
    /** @type {GrahamScan[]} */
    outerHullVerticesByFocusIndex = [];
    /** @type {BoundingBox} */
    boundingBox;

    /** @type {GridSpatialIndex} */
    spatialIndex;

    constructor (numberOfFocuses) {
        this.numberOfFocuses = numberOfFocuses;
    }

    resetPlayerPositions() {
        this.playerPositions = [];
        this.boundingBox = new BoundingBox();
    }

    addPlayerPosition(position) {
        this.playerPositions.push(position);
        this.boundingBox.add(...position);
    }

    getBoundingBox() {
        return this.boundingBox;
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

    getNumberOfPlayers() {
        return this.playerPositions.length;
    }

    getPlayerPositions() {
        return this.playerPositions;
    }

    randomizeFocuses() {
        const start = performance.now();

        this.focuses = [];
        for (let fi = 0; fi < this.numberOfFocuses; fi++) {
            const focus = this.playerPositions[Math.floor(Math.random() * this.playerPositions.length)];
            this.focuses.push(focus);
        }

        this.assignPlayersToFocuses();

        this.totalElapsedTime += performance.now() - start;
        this.numberOfRuns++;
    }

    assignPlayersToFocuses() {
        this.innerHullVerticesByFocusIndex = [];
        this.outerHullVerticesByFocusIndex = [];
        const interestSetByFocusIndex = /** @type {Set<Number>[]} */ [];

        // initialize
        for (let i = 0; i < this.numberOfFocuses; i++) {
            this.innerHullVerticesByFocusIndex.push(new GrahamScan());
            this.outerHullVerticesByFocusIndex.push(new GrahamScan());
            interestSetByFocusIndex.push(new Set());
        }

        // assign players to focuses
        for (let i = 0; i < this.playerPositions.length; i++) {
            const position = this.playerPositions[i];
            let closestFocusIndex = -1;
            let closestFocusDistanceSquared = Number.POSITIVE_INFINITY;
            for (let fi = 0; fi < this.focuses.length; fi++) {
                const focus = this.focuses[fi];
                const distanceSquared = euclideanDistanceSquared(...position, ...focus);
                if (distanceSquared < closestFocusDistanceSquared) {
                    closestFocusIndex = fi;
                    closestFocusDistanceSquared = distanceSquared;
                }
            }

            // update inner hull
            this.innerHullVerticesByFocusIndex[closestFocusIndex].addPoint(position);

            // update interest set of focus based on assigned player's neighborhood
            for (const neighborIndex of this.neighborsByPlayerIndex.get(i)) {
                interestSetByFocusIndex[closestFocusIndex].add(neighborIndex);
            }
        }

        // compose outer hull based on consolidated interest set
        for (let focusIndex = 0; focusIndex < this.numberOfFocuses; focusIndex++) {
            const playerIndexes = interestSetByFocusIndex[focusIndex];
            for (const playerIndex of playerIndexes) {
                const playerPosition = this.playerPositions[playerIndex];
                this.outerHullVerticesByFocusIndex[focusIndex].addPoint(playerPosition);
            }
        }
    }

    processPlayerPositions() {
        // must normalize so all coordinates are >= 0 (a limitation of the spatial index)
        for (const position of this.playerPositions) {
            position[0] -= this.boundingBox.left;
            position[1] -= this.boundingBox.top;
        }

        this.boundingBox.reset();
        for (const position of this.playerPositions) {
            this.boundingBox.add(...position);
        }

        this.spatialIndex = new GridSpatialIndex(SPATIAL_INDEX_CELL_EXPONENT, this.boundingBox.right, this.boundingBox.height);
        for (let i = 0; i < this.playerPositions.length; i++) {
            const position = this.playerPositions[i];
            this.spatialIndex.insert(i, ...position);
        }

        for (let i = 0; i < this.playerPositions.length; i++) {
            const position = this.playerPositions[i];
            const neighbors = this.spatialIndex.queryByCount(position[X], position[Y], NEIGHBOR_COUNT);
            this.neighborsByPlayerIndex.set(i, /** @type {Number[]} */ neighbors);
        }
    }
}