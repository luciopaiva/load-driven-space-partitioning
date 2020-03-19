
import {readCssVar} from "./utils.js";
import BoundingBox from "./bounding-box.js";
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

    /** @type {HTMLElement} */
    console = document.getElementById("console");

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

        this.initialize();

        window.addEventListener("resize", this.onResize.bind(this));

        this.updateFn = this.update.bind(this);

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

        this.partitioner.pickFocuses();
        this.drawHullsAndFocuses();
    }

    async fetchAndProcessPlayersPositions() {
        const response = await fetch("./scenario-6.tsv");
        if (response.ok) {
            const text = await response.text();
            const lines = text.split("\n");
            const mapToFloat = parseFloat.bind(window);

            this.partitioner.reset();

            for (const line of lines) {
                const rawCoordinates = line.split("\t");
                const coordinates = rawCoordinates.map(mapToFloat);
                this.partitioner.addPlayerPosition(coordinates);
            }

            const boundingBox = this.partitioner.getBoundingBox();

            this.log(`Players loaded: ${this.partitioner.getNumberOfPlayers()}`);
            this.log(`Box top: ${boundingBox.top}`);
            this.log(`Box right: ${boundingBox.right}`);
            this.log(`Box bottom: ${boundingBox.bottom}`);
            this.log(`Box left: ${boundingBox.left}`);
            this.log("Normalizing...");

            this.partitioner.update();

            this.log(`Box top: ${boundingBox.top}`);
            this.log(`Box right: ${boundingBox.right}`);
            this.log(`Box bottom: ${boundingBox.bottom}`);
            this.log(`Box left: ${boundingBox.left}`);
            this.log(`Spatial index cell count: ${this.partitioner.spatialIndex.totalCellCount}`);
        }
    }

    onKeypress(event) {
        if (event.key === " ") {
            this.partitioner.pickFocuses();
            this.drawHullsAndFocuses();
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

        const focuses = this.partitioner.getFocuses();
        for (let fi = 0; fi < focuses.length; fi++) {
            const [x, y] = this.mapSpaceToCanvasCoordinate(...focuses[fi]);

            this.focusesCtx.fillStyle = this.focusColors[fi];
            this.focusesCtx.beginPath();
            this.focusesCtx.ellipse(x, y, this.focusRadius, this.focusRadius, 0, 0, TAU, false);
            this.focusesCtx.fill();
        }

        const hulls = this.partitioner.obtainHulls();
        for (let fi = 0; fi < hulls.length; fi++) {
            const hull = hulls[fi];

            this.focusesCtx.strokeStyle = this.focusColors[fi];
            this.focusesCtx.beginPath();
            this.focusesCtx.moveTo(...this.mapSpaceToCanvasCoordinate(...hull[0]));
            for (let hi = 1; hi < hull.length; hi++) {
                this.focusesCtx.lineTo(...this.mapSpaceToCanvasCoordinate(...hull[hi]));
            }
            this.focusesCtx.closePath();
            this.focusesCtx.stroke();
        }
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
