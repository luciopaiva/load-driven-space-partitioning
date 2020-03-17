
import {readCssVar, euclideanDistanceSquared} from "./utils.js";
import GridSpatialIndex from "./grid-spatial-index.js";

const TAU = Math.PI * 2;
const SPATIAL_INDEX_CELL_EXPONENT = 14;  // cell side of approx. 164 meters (16384 cm)

class BoundingBox {
    left = 0;
    right = 0;
    top = 0;
    bottom = 0;
    width = 0;
    height = 0;

    BoundingBox() {
        this.reset();
    }

    add(x, y) {
        if (x < this.left) this.left = x;
        if (x > this.right) this.right = x;
        if (y < this.top) this.top = y;
        if (y > this.bottom) this.bottom = y;
        this.width = this.right - this.left;
        this.height = this.bottom - this.top;
    }

    reset() {
        this.left = Number.POSITIVE_INFINITY;
        this.right = Number.NEGATIVE_INFINITY;
        this.top = Number.POSITIVE_INFINITY;
        this.bottom = Number.NEGATIVE_INFINITY;
        this.width = 0;
        this.height = 0;
    }
}

class App {

    width = 0;
    height = 0;
    /** @type {HTMLCanvasElement} */
    playersCanvas;
    /** @type {CanvasRenderingContext2D} */
    playersCtx;
    /** @type {HTMLCanvasElement} */
    focusesCanvas;
    /** @type {CanvasRenderingContext2D} */
    focusesCtx;
    margin = 50;
    playerRadius = 1;

    /** @type {HTMLElement} */
    console = document.getElementById("console");

    boundingBox = new BoundingBox();
    /** @type {[Number, Number][]} */
    playerPositions = [];
    /** @type {[Number, Number][]} */
    focuses = [];
    /** @type {Number[][]} */
    playerIndexesByFocusIndex = [];

    /** @type {GridSpatialIndex} */
    spatialIndex;

    backgroundColor = readCssVar("background-color");
    playerColor = readCssVar("player-color");

    numberOfFocuses = 3;
    focusColors = [
        readCssVar("focus-color-1"),
        readCssVar("focus-color-2"),
        readCssVar("focus-color-3"),
        readCssVar("focus-color-4"),
    ];
    focusRadius = 5;

    constructor () {
        this.playersCanvas = document.createElement("canvas");
        this.playersCanvas.setAttribute("id", "players-canvas");
        this.playersCtx = this.playersCanvas.getContext("2d");
        document.body.appendChild(this.playersCanvas);

        this.focusesCanvas = document.createElement("canvas");
        this.focusesCanvas.setAttribute("id", "focuses-canvas");
        this.focusesCtx = this.focusesCanvas.getContext("2d");
        document.body.appendChild(this.focusesCanvas);

        this.initialize();

        window.addEventListener("resize", this.onResize.bind(this));

        this.updateFn = this.update.bind(this);
        // this.update(performance.now());

        document.body.addEventListener("keypress", this.onKeypress.bind(this));
    }

    /**
     * @return {void}
     */
    async initialize() {
        this.clearLog();

        await this.fetchAndProcessPlayersPositions();

        this.resize();
        this.drawPlayers();

        this.pickFocuses();
        this.drawFocuses();
    }

    async fetchAndProcessPlayersPositions() {
        const response = await fetch("./scenario-6.tsv");
        if (response.ok) {
            const text = await response.text();
            const lines = text.split("\n");
            const mapToFloat = parseFloat.bind(window);

            this.playerPositions = [];
            this.boundingBox.reset();

            for (const line of lines) {
                const rawCoordinates = line.split("\t");
                const coordinates = rawCoordinates.map(mapToFloat);
                this.boundingBox.add(...coordinates);
                this.playerPositions.push(coordinates);
            }

            this.log(`Players loaded: ${this.playerPositions.length}`);
            this.log(`Box top: ${this.boundingBox.top}`);
            this.log(`Box right: ${this.boundingBox.right}`);
            this.log(`Box bottom: ${this.boundingBox.bottom}`);
            this.log(`Box left: ${this.boundingBox.left}`);
            this.log("Normalizing...");

            // must normalize so all coordinates are >= 0 (a limitation of the spatial index)
            for (const position of this.playerPositions) {
                position[0] -= this.boundingBox.left;
                position[1] -= this.boundingBox.top;
            }

            this.boundingBox.reset();
            for (const position of this.playerPositions) {
                this.boundingBox.add(...position);
            }
            this.log(`Box top: ${this.boundingBox.top}`);
            this.log(`Box right: ${this.boundingBox.right}`);
            this.log(`Box bottom: ${this.boundingBox.bottom}`);
            this.log(`Box left: ${this.boundingBox.left}`);

            this.spatialIndex = new GridSpatialIndex(SPATIAL_INDEX_CELL_EXPONENT, this.boundingBox.right, this.boundingBox.height);
            this.log(`Spatial index cell count: ${this.spatialIndex.totalCellCount}`);
            for (let i = 0; i < this.playerPositions; i++) {
                this.spatialIndex.insert(i, this.playerPositions[i][0], this.playerPositions[i][1]);
            }
        }
    }

    onKeypress(event) {
        if (event.key === " ") {
            this.pickFocuses();
            this.drawFocuses();
        }
    }

    onResize() {
        this.resize();
        this.drawPlayers();
        this.drawFocuses();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        const widthStr = this.width.toString();
        const heightStr = this.height.toString();
        this.playersCanvas.setAttribute("width", widthStr);
        this.playersCanvas.setAttribute("height", heightStr);
        this.focusesCanvas.setAttribute("width", widthStr);
        this.focusesCanvas.setAttribute("height", heightStr);
    }

    drawPlayers() {
        const screenWidth = this.width - 2 * this.margin;
        const screenHeight = this.height - 2 * this.margin;

        this.playersCtx.clearRect(0, 0, this.width, this.height);
        this.playersCtx.fillStyle = this.playerColor;

        for (const [x, y] of this.playerPositions) {
            const cx = this.margin + screenWidth * (x - this.boundingBox.left) / this.boundingBox.width;
            const cy = this.margin + screenHeight * (y - this.boundingBox.top) / this.boundingBox.height;
            this.playersCtx.fillRect(cx, cy, this.playerRadius, this.playerRadius);
        }
    }

    pickFocuses() {
        this.focuses = [];
        for (let fi = 0; fi < this.numberOfFocuses; fi++) {
            const focus = this.playerPositions[Math.floor(Math.random() * this.playerPositions.length)];
            this.focuses.push(focus);
        }

        this.playerIndexesByFocusIndex = Array.from(new Array(this.numberOfFocuses), () => []);
        for (let playerIndex = 0; playerIndex < this.playerPositions.length; playerIndex++) {
            const position = this.playerPositions[playerIndex];
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
            this.playerIndexesByFocusIndex[closestFocusIndex].push(playerIndex);
        }

        console.info(this.playerIndexesByFocusIndex);
    }

    drawFocuses() {
        const screenWidth = this.width - 2 * this.margin;
        const screenHeight = this.height - 2 * this.margin;

        this.focusesCtx.clearRect(0, 0, this.width, this.height);

        for (let fi = 0; fi < this.focuses.length; fi++) {
            const [x, y] = this.focuses[fi];

            const cx = this.margin + screenWidth * (x - this.boundingBox.left) / this.boundingBox.width;
            const cy = this.margin + screenHeight * (y - this.boundingBox.top) / this.boundingBox.height;

            this.focusesCtx.fillStyle = this.focusColors[fi];
            this.focusesCtx.beginPath();
            this.focusesCtx.ellipse(cx, cy, this.focusRadius, this.focusRadius, 0, 0, TAU, false);
            this.focusesCtx.fill();
        }
    }

    update() {
        requestAnimationFrame(this.updateFn);
    }

    clearLog() {
        this.console.innerText = "";
    }

    log(msg) {
        this.console.innerText += msg + "\n";
    }
}

window.addEventListener("load", () => new App());
