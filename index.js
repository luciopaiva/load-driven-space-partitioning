
import {readCssVar} from "./utils.js";
import GridSpatialIndex from "./grid-spatial-index.js";

const TAU = Math.PI * 2;

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
    itemsCanvas;
    /** @type {CanvasRenderingContext2D} */
    itemsCtx;
    /** @type {HTMLCanvasElement} */
    focusesCanvas;
    /** @type {CanvasRenderingContext2D} */
    focusesCtx;
    margin = 50;
    itemRadius = 1;

    /** @type {HTMLElement} */
    console = document.getElementById("console");

    limits = new BoundingBox();
    /** @type {[Number, Number][]} */
    positions = [];
    /** @type {[Number, Number][]} */
    focuses = [];

    backgroundColor = readCssVar("background-color");
    itemColor = readCssVar("item-color");

    numberOfFocuses = 3;
    focusColors = [
        readCssVar("focus-color-1"),
        readCssVar("focus-color-2"),
        readCssVar("focus-color-3"),
        readCssVar("focus-color-4"),
    ];
    focusRadius = 5;

    constructor () {
        this.itemsCanvas = document.createElement("canvas");
        this.itemsCanvas.setAttribute("id", "items-canvas");
        this.itemsCtx = this.itemsCanvas.getContext("2d");
        document.body.appendChild(this.itemsCanvas);

        this.focusesCanvas = document.createElement("canvas");
        this.focusesCanvas.setAttribute("id", "focuses-canvas");
        this.focusesCtx = this.focusesCanvas.getContext("2d");
        document.body.appendChild(this.focusesCanvas);

        this.initialize();

        window.addEventListener("resize", this.resize.bind(this));
        this.resize();

        this.updateFn = this.update.bind(this);
        // this.update(performance.now());

        document.body.addEventListener("keypress", this.keypress.bind(this));
    }

    /**
     * @return {void}
     */
    async initialize() {
        const response = await fetch("./scenario-6.tsv");
        if (response.ok) {
            const text = await response.text();
            const lines = text.split("\n");
            const mapToFloat = parseFloat.bind(window);

            this.positions = [];
            this.limits.reset();

            for (const line of lines) {
                const rawCoordinates = line.split("\t");
                const coordinates = rawCoordinates.map(mapToFloat);
                this.limits.add(...coordinates);
                this.positions.push(coordinates);
            }

            this.log(`Items loaded: ${this.positions.length}`);
            this.log(`Box top: ${this.limits.top}`);
            this.log(`Box right: ${this.limits.right}`);
            this.log(`Box bottom: ${this.limits.bottom}`);
            this.log(`Box left: ${this.limits.left}`);
            this.log("Normalizing...");

            for (const position of this.positions) {
                position[0] -= this.limits.left;
                position[1] -= this.limits.top;
            }

            this.limits.reset();
            for (const position of this.positions) {
                this.limits.add(...position);
            }
            this.log(`Box top: ${this.limits.top}`);
            this.log(`Box right: ${this.limits.right}`);
            this.log(`Box bottom: ${this.limits.bottom}`);
            this.log(`Box left: ${this.limits.left}`);

            this.reload();
        }
    }

    reload() {
        this.resize();
        this.drawPositions();
        this.pickAndDrawFocuses();
    }

    keypress(event) {
        if (event.key === " ") {
            this.pickAndDrawFocuses();
        }
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        const widthStr = this.width.toString();
        const heightStr = this.height.toString();
        this.itemsCanvas.setAttribute("width", widthStr);
        this.itemsCanvas.setAttribute("height", heightStr);
        this.focusesCanvas.setAttribute("width", widthStr);
        this.focusesCanvas.setAttribute("height", heightStr);
    }

    drawPositions() {
        const screenWidth = this.width - 2 * this.margin;
        const screenHeight = this.height - 2 * this.margin;

        this.itemsCtx.clearRect(0, 0, this.width, this.height);
        this.itemsCtx.fillStyle = this.itemColor;

        for (const [x, y] of this.positions) {
            const cx = this.margin + screenWidth * (x - this.limits.left) / this.limits.width;
            const cy = this.margin + screenHeight * (y - this.limits.top) / this.limits.height;
            this.itemsCtx.fillRect(cx, cy, this.itemRadius, this.itemRadius);
        }
    }

    pickAndDrawFocuses() {
        const screenWidth = this.width - 2 * this.margin;
        const screenHeight = this.height - 2 * this.margin;

        this.focusesCtx.clearRect(0, 0, this.width, this.height);

        this.focuses = [];
        for (let fi = 0; fi < this.numberOfFocuses; fi++) {
            const focus = this.positions[Math.floor(Math.random() * this.positions.length)];
            this.focuses.push(focus);
            const [x, y] = focus;

            const cx = this.margin + screenWidth * (x - this.limits.left) / this.limits.width;
            const cy = this.margin + screenHeight * (y - this.limits.top) / this.limits.height;

            this.focusesCtx.fillStyle = this.focusColors[fi];
            this.focusesCtx.beginPath();
            this.focusesCtx.ellipse(cx, cy, this.focusRadius, this.focusRadius, 0, 0, TAU, false);
            this.focusesCtx.fill();
        }
    }

    update() {
        requestAnimationFrame(this.updateFn);
    }

    log(msg) {
        this.console.innerText += msg + "\n";
    }
}

window.addEventListener("load", () => new App());
