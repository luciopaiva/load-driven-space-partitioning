
import {readCssVar} from "./utils.js";

const TAU = Math.PI * 2;

class BoundingBox {
    left = Number.POSITIVE_INFINITY;
    right = Number.NEGATIVE_INFINITY;
    top = Number.POSITIVE_INFINITY;
    bottom = Number.NEGATIVE_INFINITY;
    width = 0;
    height = 0;

    add(x, y) {
        if (x < this.left) this.left = x;
        if (x > this.right) this.right = x;
        if (y < this.top) this.top = y;
        if (y > this.bottom) this.bottom = y;
        this.width = this.right - this.left;
        this.height = this.bottom - this.top;
    }
}

class App {

    width = 0;
    height = 0;
    /** @type {HTMLCanvasElement} */
    canvas;
    /** @type {CanvasRenderingContext2D} */
    ctx;
    margin = 50;
    itemRadius = 1;

    /** @type {HTMLElement} */
    console = document.getElementById("console");

    limits = new BoundingBox();
    /** @type {[Number, Number][]} */
    positions = [];

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
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
        document.body.appendChild(this.canvas);

        this.initialize();

        window.addEventListener("resize", this.resize.bind(this));
        this.resize();

        this.updateFn = this.update.bind(this);
        // this.update(performance.now());
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
            for (const line of lines) {
                const rawCoordinates = line.split("\t");
                const coordinates = rawCoordinates.map(mapToFloat);
                this.limits.add(...coordinates);
                this.positions.push(coordinates);
            }
            this.log(`Items loaded: ${this.positions.length}`);
            this.reload();
        }
    }

    reload() {
        this.resize();
        this.drawPositions();
        this.pickAndDrawFocuses();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.setAttribute("width", this.width.toString());
        this.canvas.setAttribute("height", this.height.toString());
    }

    drawPositions() {
        const screenWidth = this.width - 2 * this.margin;
        const screenHeight = this.height - 2 * this.margin;

        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = this.itemColor;

        for (const [x, y] of this.positions) {
            const cx = this.margin + screenWidth * (x - this.limits.left) / this.limits.width;
            const cy = this.margin + screenHeight * (y - this.limits.top) / this.limits.height;
            this.ctx.fillRect(cx, cy, this.itemRadius, this.itemRadius);
        }
    }

    pickAndDrawFocuses() {
        const screenWidth = this.width - 2 * this.margin;
        const screenHeight = this.height - 2 * this.margin;

        this.ctx.fillStyle = this.itemColor;

        for (let fi = 0; fi < this.numberOfFocuses; fi++) {
            const [x, y] = this.positions[Math.floor(Math.random() * this.positions.length)];

            const cx = this.margin + screenWidth * (x - this.limits.left) / this.limits.width;
            const cy = this.margin + screenHeight * (y - this.limits.top) / this.limits.height;

            this.ctx.fillStyle = this.focusColors[fi];
            this.ctx.beginPath();
            this.ctx.ellipse(cx, cy, this.focusRadius, this.focusRadius, 0, 0, TAU, false);
            this.ctx.fill();
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
