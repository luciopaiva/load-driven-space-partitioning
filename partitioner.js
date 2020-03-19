
import GrahamScan from "./node_modules/@lucio/graham-scan/graham-scan.mjs";
import GridSpatialIndex from "./grid-spatial-index.js";
import BoundingBox from "./bounding-box.js";
import {euclideanDistanceSquared} from "./utils.js";

const SPATIAL_INDEX_CELL_EXPONENT = 14;  // cell side of approx. 164 meters (16384 cm)

export default class Partitioner {

    /** @type {Number} */
    numberOfFocuses = 1;

    /** @type {[Number, Number][]} */
    playerPositions = [];
    /** @type {[Number, Number][]} */
    focuses = [];
    /** @type {GrahamScan[]} */
    hullVerticesByFocusIndex = [];
    /** @type {BoundingBox} */
    boundingBox;

    /** @type {GridSpatialIndex} */
    spatialIndex;

    constructor (numberOfFocuses) {
        this.numberOfFocuses = numberOfFocuses;
    }

    reset() {
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

    obtainHulls() {
        return this.hullVerticesByFocusIndex.map(vertices => vertices.getHull());
    }

    getNumberOfPlayers() {
        return this.playerPositions.length;
    }

    getPlayerPositions() {
        return this.playerPositions;
    }

    pickFocuses() {
        this.focuses = [];
        for (let fi = 0; fi < this.numberOfFocuses; fi++) {
            const focus = this.playerPositions[Math.floor(Math.random() * this.playerPositions.length)];
            this.focuses.push(focus);
        }

        // assign players to nearest focus
        this.hullVerticesByFocusIndex = [];
        for (let i = 0; i < this.numberOfFocuses; i++) {
            this.hullVerticesByFocusIndex.push(new GrahamScan());
        }

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
            this.hullVerticesByFocusIndex[closestFocusIndex].addPoint(position);
        }
    }

    update() {
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
    }
}