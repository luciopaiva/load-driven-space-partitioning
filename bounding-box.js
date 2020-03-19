
export default class BoundingBox {
    left = 0;
    right = 0;
    top = 0;
    bottom = 0;
    width = 0;
    height = 0;

    constructor () {
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
