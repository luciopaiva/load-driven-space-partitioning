
import {readCssVar} from "./utils.js";
import Partitioner from "./partitioner.js";

const TAU = Math.PI * 2;

class App {

    width = 0;
    height = 0;
    netCanvasWidth = 0;
    netCanvasHeight = 0;
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

    isRunning = true;

    partitioner = new Partitioner(4);

    playerColor = readCssVar("player-color");

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

        this.runsElement = document.getElementById("number-of-runs");
        this.avgRunningTimeElement = document.getElementById("avg-running-time");
        this.numberOfForwardsElement = document.getElementById("number-of-forwards");
        this.numberOfFailuresElement = document.getElementById("number-of-failures");
        this.numberOfSuccessesElement = document.getElementById("number-of-successes");
        this.loadFactorElements = [];
        this.loadFactorElements.push(document.getElementById("lf-1"));
        this.loadFactorElements.push(document.getElementById("lf-2"));
        this.loadFactorElements.push(document.getElementById("lf-3"));
        this.loadFactorElements.push(document.getElementById("lf-4"));

        window.addEventListener("resize", this.onResize.bind(this));
        document.body.addEventListener("keypress", this.onKeypress.bind(this));

        this.updateFn = this.update.bind(this);

        this.initialize();
    }

    /**
     * @return {void}
     */
    async initialize() {
        await this.fetchAndProcessPlayersPositions();

        this.resize();
        this.drawPlayers();

        requestAnimationFrame(this.updateFn);
    }

    async fetchAndProcessPlayersPositions() {
        const response = await fetch("./scenario.tsv");
        if (response.ok) {
            const text = await response.text();
            const lines = text.split("\n");
            const mapToFloat = parseFloat.bind(window);

            this.partitioner.resetPlayerPositions();

            for (const line of lines) {
                const rawCoordinates = line.split("\t");
                const coordinates = rawCoordinates.map(mapToFloat);
                this.partitioner.addPlayerPosition(coordinates);
            }

            const boundingBox = this.partitioner.getBoundingBox();

            console.log(`Players loaded: ${this.partitioner.getNumberOfPlayers()}`);
            console.log(`Box top: ${boundingBox.top}`);
            console.log(`Box right: ${boundingBox.right}`);
            console.log(`Box bottom: ${boundingBox.bottom}`);
            console.log(`Box left: ${boundingBox.left}`);
            console.log("Normalizing...");

            const processTimeStart = performance.now();
            this.partitioner.processPlayerPositions();
            const processElapsed = performance.now() - processTimeStart;

            console.log(`Box top: ${boundingBox.top}`);
            console.log(`Box right: ${boundingBox.right}`);
            console.log(`Box bottom: ${boundingBox.bottom}`);
            console.log(`Box left: ${boundingBox.left}`);
            console.log(`Spatial index cell count: ${this.partitioner.spatialIndex.totalCellCount}`);
            console.log(`Structures initialization: ${processElapsed.toFixed(1)} ms`);
        }
    }

    onKeypress(event) {
        if (event.key === " ") {
            this.isRunning = !this.isRunning;
        }
    }

    onResize() {
        this.resize();
        this.drawPlayers();
        this.drawHullsAndFocuses();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.netCanvasWidth = this.width - 2 * this.margin;
        this.netCanvasHeight = this.height - 2 * this.margin;
        const widthStr = this.width.toString();
        const heightStr = this.height.toString();
        this.playersCanvas.setAttribute("width", widthStr);
        this.playersCanvas.setAttribute("height", heightStr);
        this.focusesCanvas.setAttribute("width", widthStr);
        this.focusesCanvas.setAttribute("height", heightStr);
    }

    drawPlayers() {
        this.playersCtx.clearRect(0, 0, this.width, this.height);
        this.playersCtx.fillStyle = this.playerColor;

        for (const [x, y] of this.partitioner.getPlayerPositions()) {
            this.playersCtx.fillRect(...this.mapSpaceToCanvasCoordinate(x, y), this.playerRadius, this.playerRadius);
        }
    }

    drawHullsAndFocuses() {
        this.focusesCtx.clearRect(0, 0, this.width, this.height);

        const snapshot = this.partitioner.bestSnapshot;

        const focuses = snapshot.getFocuses();
        for (let fi = 0; fi < focuses.length; fi++) {
            const [x, y] = this.mapSpaceToCanvasCoordinate(...focuses[fi]);

            this.focusesCtx.fillStyle = this.focusColors[fi];
            this.focusesCtx.beginPath();
            this.focusesCtx.ellipse(x, y, this.focusRadius, this.focusRadius, 0, 0, TAU, false);
            this.focusesCtx.fill();
        }

        const innerHulls = snapshot.obtainInnerHulls();
        const outerHulls = snapshot.obtainOuterHulls();

        for (let fi = 0; fi < innerHulls.length; fi++) {
            const innerHull = innerHulls[fi];
            const outerHull = outerHulls[fi];

            // It's possible for a hull to be empty. If two focuses coincide to be at the same exact coordinate, one of
            // them will get all nearby players, while the other will get none.
            if (innerHull.length > 0) {
                this.focusesCtx.strokeStyle = this.focusColors[fi];

                this.drawHull(innerHull);
                this.drawHull(outerHull);
            }
        }
    }

    drawHull(hull) {
        this.focusesCtx.beginPath();
        this.focusesCtx.moveTo(...this.mapSpaceToCanvasCoordinate(...hull[0]));
        for (let hi = 1; hi < hull.length; hi++) {
            this.focusesCtx.lineTo(...this.mapSpaceToCanvasCoordinate(...hull[hi]));
        }
        this.focusesCtx.closePath();
        this.focusesCtx.stroke();
    }

    /**
     * @param x
     * @param y
     * @return {[Number, Number]}
     */
    mapSpaceToCanvasCoordinate(x, y) {
        const boundingBox = this.partitioner.getBoundingBox();
        return [
            this.margin + this.netCanvasWidth * (x - boundingBox.left) / boundingBox.width,
            this.margin + this.netCanvasHeight * (y - boundingBox.top) / boundingBox.height
        ];
    }

    update() {
        if (this.isRunning) {
            this.randomizeFocuses();
        }
        requestAnimationFrame(this.updateFn);
    }

    randomizeFocuses() {
        const successfulAttempt = this.partitioner.randomizeFocuses();
        if (successfulAttempt) {
            this.drawHullsAndFocuses();
        }
        this.updateHUD(successfulAttempt);
    }

    updateHUD(shouldUpdatePartitioningMetrics) {

        this.runsElement.innerText = this.partitioner.numberOfRuns.toString();
        const avg = this.partitioner.totalElapsedTime / this.partitioner.numberOfRuns;
        this.avgRunningTimeElement.innerText = avg.toFixed(1) + " ms";
        this.numberOfFailuresElement.innerText = this.partitioner.numberOfFailures.toString();
        this.numberOfSuccessesElement.innerText =
            (this.partitioner.numberOfRuns - this.partitioner.numberOfFailures).toString();

        if (shouldUpdatePartitioningMetrics) {
            const playerCount = this.partitioner.playerPositions.length;
            const numberOfFocuses = this.partitioner.numberOfFocuses;
            const maxForwards = playerCount * (numberOfFocuses - 1);

            const snapshot = this.partitioner.bestSnapshot;

            const perc = 100 * snapshot.numberOfForwards / maxForwards;
            this.numberOfForwardsElement.innerText = snapshot.numberOfForwards.toString() +
                ` (${perc.toFixed(1)}%)`;
            for (let i = 0; i < snapshot.numberOfFocuses; i++) {
                this.loadFactorElements[i].innerText = snapshot.getFocusLoadFactor(i).toFixed(1) + "%";
            }
        }
    }
}

window.addEventListener("load", () => new App());
