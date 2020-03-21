
import GridSpatialIndex from "./grid-spatial-index.js";
import BoundingBox from "./bounding-box.js";
import Snapshot from "./snapshot.js";
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
    numberOfFailures = 0;
    /** @type {Number} */
    totalElapsedTime = 0;

    /** @type {[Number, Number][]} */
    playerPositions = [];
    /** @type {Uint32Array[]} */
    neighborsByPlayerIndex = [];
    /** @type {BoundingBox} */
    boundingBox;

    /** @type {Snapshot} */
    currentSnapshot;
    /** @type {Snapshot} */
    bestSnapshot = new Snapshot();

    /** @type {GridSpatialIndex} */
    spatialIndex;

    constructor (numberOfFocuses) {
        this.numberOfFocuses = numberOfFocuses;
        // initial best is the worst possible
        this.bestSnapshot.numberOfForwards = Number.POSITIVE_INFINITY;
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

    getNumberOfPlayers() {
        return this.playerPositions.length;
    }

    getPlayerPositions() {
        return this.playerPositions;
    }

    randomizeFocuses() {
        const start = performance.now();

        this.initializeSnapshot();

        for (let fi = 0; fi < this.numberOfFocuses; fi++) {
            const focus = this.placeFocus();
            this.currentSnapshot.focuses.push(focus);
        }

        // n - number of players
        // m - number of focuses
        // k - number of neighbors

        // O(n * m)
        this.assignPlayersToFocuses();
        // O(n * k)
        this.computeExternalInterestSets();
        // O(m)
        const successfulAttempt = this.computeLoadFactors();

        this.totalElapsedTime += performance.now() - start;
        this.numberOfRuns++;

        return successfulAttempt;
    }

    initializeSnapshot() {
        this.currentSnapshot = new Snapshot(this.numberOfFocuses);
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
        const snapshot = this.currentSnapshot;

        // assign players to focuses
        for (let i = 0; i < this.playerPositions.length; i++) {
            const position = this.playerPositions[i];
            let closestFocusIndex = -1;
            let closestFocusDistanceSquared = Number.POSITIVE_INFINITY;
            for (let fi = 0; fi < snapshot.focuses.length; fi++) {
                const focus = snapshot.focuses[fi];
                const distanceSquared = euclideanDistanceSquared(...position, ...focus);
                if (distanceSquared < closestFocusDistanceSquared) {
                    closestFocusIndex = fi;
                    closestFocusDistanceSquared = distanceSquared;
                }
            }

            snapshot.addPlayerToFocus(i, position, closestFocusIndex);
        }
    }

    computeExternalInterestSets() {
        const snapshot = this.currentSnapshot;

        // compute external interest sets
        for (let focusIndex = 0; focusIndex < this.numberOfFocuses; focusIndex++) {
            const ownPlayers = snapshot.getOwnPlayersByFocusIndex(focusIndex);

            for (const playerIndex of ownPlayers.values()) {
                const neighbors = this.neighborsByPlayerIndex[playerIndex];
                for (const neighborIndex of neighbors) {
                    if (!ownPlayers.has(neighborIndex)) {
                        const neighborPosition = this.playerPositions[neighborIndex];
                        snapshot.addExternalPlayerToFocus(neighborIndex, neighborPosition, focusIndex);
                    }
                }
            }
        }
    }

    computeLoadFactors() {
        const snapshot = this.currentSnapshot;

        // compute external interest sets
        for (let focusIndex = 0; focusIndex < this.numberOfFocuses; focusIndex++) {
            const ownPlayers = snapshot.getOwnPlayersByFocusIndex(focusIndex);
            const externalInterestSet = snapshot.getExternalInterestSetByFocusIndex(focusIndex);

            // compute load factor
            const totalTimeInMicros = PLAYER_STATE_SEND_FREQ_IN_HZ * (
                ownPlayers.size * PROC_TIME_MINE_IN_MICROS +
                externalInterestSet.size * PROC_TIME_OTHER_IN_MICROS
            );

            const loadFactor = 100 * (totalTimeInMicros / 1_000_000);  // between 0 and 100%

            if (loadFactor > MAX_COMFORTABLE_LOAD_FACTOR) {
                snapshot.isWithinComfortableLFThreshold = false;
                this.numberOfFailures++;
                return false;
            }

            snapshot.setFocusLoadFactor(focusIndex, loadFactor);
            snapshot.incrementNumberOfForwards(externalInterestSet.size);
        }

        snapshot.isWithinComfortableLFThreshold = true;

        if (snapshot.numberOfForwards < this.bestSnapshot.numberOfForwards) {
            this.bestSnapshot = snapshot;
            return true;
        }

        return false;
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

        this.neighborsByPlayerIndex = [];
        for (let i = 0; i < this.playerPositions.length; i++) {
            const position = this.playerPositions[i];

            const neighbors = /** @type {Number[]} */ this.spatialIndex.queryByCount(position[X], position[Y], NEIGHBOR_COUNT);
            const neighborsBuffer = new Uint32Array(neighbors.length);
            for (let j = 0; j < neighbors.length; j++) {
                neighborsBuffer[j] = neighbors[j];
            }
            this.neighborsByPlayerIndex.push(neighborsBuffer);
        }
    }
}
