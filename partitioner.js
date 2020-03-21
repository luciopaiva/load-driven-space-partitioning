
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
const PROC_TIME_MINE_IN_MICROS = 20;
const PROC_TIME_OTHER_IN_MICROS = 1;
const MAX_COMFORTABLE_LOAD_FACTOR = 50;
const PLAYER_STATE_SEND_FREQ_IN_HZ = 5;
const FOCUS_PLACEMENT_STRATEGY_PLAYER_POSITIONS = 1;
const FOCUS_PLACEMENT_STRATEGY_BOUNDING_BOX = 2;
const FOCUS_PLACEMENT_STRATEGY = FOCUS_PLACEMENT_STRATEGY_BOUNDING_BOX;

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

    /** @type {Number[]} */
    loadFactorByFocusIndex = [];
    /** @type {Number} */
    totalNumberOfForwards = 0;
    /** @type {Number} */
    bestTotalNumberOfForwards = Number.POSITIVE_INFINITY;

    numberOfFailures = 0;

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
            const focus = this.placeFocus();
            this.focuses.push(focus);
        }

        const successfulAttempt = this.assignPlayersToFocuses();

        this.totalElapsedTime += performance.now() - start;
        this.numberOfRuns++;

        return successfulAttempt;
    }

    placeFocus() {
        if (FOCUS_PLACEMENT_STRATEGY === FOCUS_PLACEMENT_STRATEGY_PLAYER_POSITIONS) {
            return this.playerPositions[Math.floor(Math.random() * this.playerPositions.length)]
        } else {
            const x = Math.random() * this.boundingBox.width;
            const y = Math.random() * this.boundingBox.height;
            return [x, y];
        }
    }

    assignPlayersToFocuses() {
        this.innerHullVerticesByFocusIndex = [];
        this.outerHullVerticesByFocusIndex = [];
        const ownPlayersByFocusIndex = /** @type {Set<Number>[]} */ [];
        const interestSetByFocusIndex = /** @type {Set<Number>[]} */ [];

        this.totalNumberOfForwards = 0;

        // initialize
        for (let i = 0; i < this.numberOfFocuses; i++) {
            this.innerHullVerticesByFocusIndex.push(new GrahamScan());
            this.outerHullVerticesByFocusIndex.push(new GrahamScan());
            ownPlayersByFocusIndex.push(new Set());
            interestSetByFocusIndex.push(new Set());
            this.loadFactorByFocusIndex[i] = 0;
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
            // the outer hull also needs to contain own clients
            this.outerHullVerticesByFocusIndex[closestFocusIndex].addPoint(position);

            ownPlayersByFocusIndex[closestFocusIndex].add(i);
        }

        // compute external interest sets
        for (let focusIndex = 0; focusIndex < this.numberOfFocuses; focusIndex++) {
            const ownPlayers = ownPlayersByFocusIndex[focusIndex];
            const externalInterestSet = interestSetByFocusIndex[focusIndex];

            for (const playerIndex of ownPlayers.values()) {
                for (const neighborIndex of this.neighborsByPlayerIndex.get(playerIndex)) {
                    if (!ownPlayers.has(neighborIndex)) {
                        externalInterestSet.add(neighborIndex);
                    }
                }
            }

            const totalTimeInMicros = PLAYER_STATE_SEND_FREQ_IN_HZ * (
                ownPlayers.size * PROC_TIME_MINE_IN_MICROS +
                externalInterestSet.size * PROC_TIME_OTHER_IN_MICROS
            );
            const loadFactor = 100 * (totalTimeInMicros / 1_000_000);  // between 0 and 100%
            if (loadFactor > MAX_COMFORTABLE_LOAD_FACTOR) {
                this.numberOfFailures++;
                return false;
            }
            this.loadFactorByFocusIndex[focusIndex] = loadFactor;
            this.totalNumberOfForwards += externalInterestSet.size;
        }

        if (this.totalNumberOfForwards >= this.bestTotalNumberOfForwards) {
            // was not able to improve over best so far
            return false;
        }
        this.bestTotalNumberOfForwards = this.totalNumberOfForwards;

        // compose outer hulls based on consolidated interest sets
        for (let focusIndex = 0; focusIndex < this.numberOfFocuses; focusIndex++) {
            const playerIndexes = interestSetByFocusIndex[focusIndex];
            for (const playerIndex of playerIndexes) {
                const playerPosition = this.playerPositions[playerIndex];
                this.outerHullVerticesByFocusIndex[focusIndex].addPoint(playerPosition);
            }
        }

        return true;
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