
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

    limits = new BoundingBox();
    /** @type {[Number, Number][]} */
    positions = [];

    itemColor = readCssVar("item-color");

    constructor () {
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
        document.body.appendChild(this.canvas);

        this.initialize();

        window.addEventListener("resize", this.resize.bind(this));
        this.resize();

        this.updateFn = this.update.bind(this);
        this.update(performance.now());
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
            this.resize();
        }
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.setAttribute("width", this.width.toString());
        this.canvas.setAttribute("height", this.height.toString());

        this.drawPositions();
    }

    drawPositions() {
        this.ctx.fillStyle = this.itemColor;
        for (const [x, y] of this.positions) {
            const cx = this.width * (x - this.limits.left) / this.limits.width;
            const cy = this.height * (y - this.limits.top) / this.limits.height;
            this.ctx.beginPath();
            this.ctx.ellipse(cx, cy, 3, 3, 0, 0, TAU, false);
            this.ctx.fill();
        }
    }

    update() {
        // this.ctx.clearRect(0, 0, this.width, this.height);
        // this.ctx.strokeStyle = "white";
        // this.ctx.beginPath();
        // this.ctx.moveTo(0, 0);
        // this.ctx.lineTo(this.width, this.height);
        // this.ctx.stroke();

        requestAnimationFrame(this.updateFn);
    }
}

window.addEventListener("load", () => new App());
