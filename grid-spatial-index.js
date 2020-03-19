
import {euclideanDistanceSquared} from "./utils.js";

/**
 * Holds a spatial index element. Contains not only the element and its position, as well as an optional data object and
 * a pointer to the next sibling entry in that cell's linked list.
 */
class CellEntry {

    /**
     * @param {Object} element
     * @param {Number} x
     * @param {Number} y
     * @param {GridSpatialIndexCell} cell
     */
    constructor (element, x, y, cell) {
        this.element = element;
        this.x = x;
        this.y = y;
        this.cell = cell;
    }
}

/**
 * An internal structure representing a cell in the grid.
 */
class GridSpatialIndexCell {

    /**
     * @param {Number} index the cell index
     */
    constructor (index) {
        /** @type {Number} this cell's index */
        this.index = index;
        /** @type {Set<CellEntry>} this cell's entries */
        this.entries = new Set();
    }

    /**
     * Add an entry to this cell.
     *
     * @param {CellEntry} entry
     */
    insert(entry) {
        entry.cell = this;
        this.entries.add(entry);
    }

    /**
     * Removes an entry from this cell.
     * @param {CellEntry} entry
     */
    remove(entry) {
        if (this.entries.delete(entry)) {
            entry.cell = null;
        }
    }
}

/**
 * A very simple (but yet efficient) spatial index.
 *
 * Divides the board into square cells of fixed size. A cell's size is always a power of 2, so inserting and querying
 * operations are fast due to the use of bitwise operations.
 */
export default class GridSpatialIndex {

    /**
     * The query will return all elements within the grid cells touched by the radius specified. This is the cheapest
     * option, but can return a lot of unwanted elements. */
    static QUERY_MODE_RAW = 0;
    /** The query will return all elements within the circle delimited by the query's radius. This is the most expensive
     * option, as the query will compute the euclidean distance from the reference to each candidate. */
    static QUERY_MODE_CIRCLE = 1;
    /** The query will return all elements within the squared delimited of sides equal to the radius times two. This is
     * a trade-off between the options above. It avoids the euclidean distance computation and potentially brings far
     * less false positives than the first option. */
    static QUERY_MODE_SQUARE = 2;

    /**
     * @param {Number} cellSizeExponent A power of two exponent representing a cell square's size
     * @param {Number} width The width of the board. Does not need to be a power of two.
     * @param {Number} height The height of the board. Does not need to be a power of two.
     */
    constructor (cellSizeExponent, width, height) {
        /** @type {Map<Object, CellEntry>} */
        this.cellEntryByKey = new Map();

        this.isAlwaysWithinRadiusFunction = this.isAlwaysWithinRadius.bind(this);

        this.cellSizeExponent = cellSizeExponent;
        this.cellSize = 1 << this.cellSizeExponent;
        this.width = width;
        this.widthInCells = Math.ceil(this.width / this.cellSize);
        this.height = height;
        this.heightInCells = Math.ceil(this.height / this.cellSize);

        this.totalCellCount = this.widthInCells * this.heightInCells;

        this.cells = /** @type {GridSpatialIndexCell[]} */ Array(this.totalCellCount);

        for (let i = 0; i < this.totalCellCount; i++) {
            this.cells[i] = new GridSpatialIndexCell(i);
        }
    }

    /**
     * Insert an element in the spatial index at coordinates x,y. If the element already exists in the index, it is
     * updated.
     *
     * @param {Object} key a unique identifier representing the element
     * @param {Number} x the x coordinate of the element
     * @param {Number} y the y coordinate of the element
     * @return {Boolean} true if the element was inserted, false if it was just updated
     */
    insert(key, x, y) {
        const cellIndex = this.positionToCellIndex(x, y);
        const cell = this.cells[cellIndex];
        if (!cell) {
            throw new Error(`Coordinate ${x},${y} is out of bounds`);
        }

        let cellEntry = this.cellEntryByKey.get(key);
        if (cellEntry) {
            // element was already present in the index; check its current cell and update it if necessary
            if (cellEntry.cell.index !== cellIndex) {
                const previousCell = cellEntry.cell;
                previousCell.remove(cellEntry);
                cell.insert(cellEntry);
            }
            return false;
        } else {
            // new element, let's create an entry for it
            cellEntry = new CellEntry(key, x, y, cell);
            cell.insert(cellEntry);
            this.cellEntryByKey.set(key, cellEntry);
            return true;
        }
    }

    /**
     * @param {Object} key the element to be removed
     * @return {boolean} true if the element was removed, false if it was not found
     */
    remove(key) {
        const cellEntry = this.cellEntryByKey.get(key);
        if (cellEntry) {
            const cell = cellEntry.cell;
            cell.remove(cellEntry);
            this.cellEntryByKey.delete(key);
            return true;
        }
        return false;
    }

    /**
     * Converts x,y coordinates to a cell index in the grid.
     *
     * @private
     * @param {Number} x
     * @param {Number} y
     * @return {Number}
     */
    positionToCellIndex(x, y) {
        const col = x >>> this.cellSizeExponent;
        const row = y >>> this.cellSizeExponent;
        return row * this.widthInCells + col;
    }

    /**
     * @param {Number} x
     * @param {Number} y
     * @param {Number} radius
     * @param {Boolean} [debugMode]
     * @return {IterableIterator<GridSpatialIndexCell>}
     */
    *iterateRelevantCells(x, y, radius, debugMode = false) {
        const top = this.constrain(0, y - radius, this.height);
        const right = this.constrain(0, x + radius, this.width);
        const bottom = this.constrain(0, y + radius, this.height);
        const left = this.constrain(0, x - radius, this.width);

        const rowStart = top >>> this.cellSizeExponent;
        const rowEnd = bottom >>> this.cellSizeExponent;
        const colStart = left >>> this.cellSizeExponent;
        const colEnd = right >>> this.cellSizeExponent;

        if (debugMode) {
            this.debugQueryCells(rowStart, rowEnd, colStart, colEnd);
        }

        for (let row = rowStart; row <= rowEnd; row++) {
            for (let col = colStart; col <= colEnd; col++) {
                const cellIndex = row * this.widthInCells + col;
                if (cellIndex >= this.cells.length) {
                    throw new Error(`Cell index ${cellIndex} out of bounds (x=${x}, y=${y}, radius=${radius}, ` +
                        `top=${top}, right=${right}, bottom=${bottom}, left=${left}, row=${row}, col=${col}, ` +
                        `cells.length=${this.cells.length})`);
                }
                yield this.cells[cellIndex];
            }
        }
    }

    constrain(min, val, max) {
        return Math.max(min, Math.min(val, max));
    }

    /**
     * Queries the spatial index for elements. Results are *not* ordered by distance.
     *
     * @param {Number} x
     * @param {Number} y
     * @param {Number} cullingRadius
     * @param {Number} mode specifies how the query should be performed (see GridSpatialIndex's query modes)
     * @param {Boolean} debugMode
     * @return {IterableIterator<Object>}
     */
    *query(x, y, cullingRadius, mode = GridSpatialIndex.QUERY_MODE_CIRCLE, debugMode = false) {
        const checkDistance = this.obtainDistanceFunction(mode, cullingRadius, x, y);

        for (const cell of this.iterateRelevantCells(x, y, cullingRadius, debugMode)) {
            for (const entry of cell.entries) {
                if (checkDistance(entry.x, entry.y)) {
                    yield entry.element;
                }
            }
        }
    }

    /**
     * @param {Number} x
     * @param {Number} y
     * @param {Number} count
     * @return {Object[]}
     */
    queryByCount(x, y, count) {
        const entries = /** @type {CellEntry} */ [];

        // collect items
        let level = 0;
        while (entries.length < count) {
            level++;
            let cellCount = 0;
            for (const cell of this.iterateCellsAtPosition(x, y, level)) {
                entries.push(...cell.entries.values());
                cellCount++;
            }
            if (cellCount === 0) {
                break;  // no new cells
            }
        }

        // order by distance
        // ToDo replace this with quick select of first `count` only
        entries.sort((a, b) => {
            const distA = euclideanDistanceSquared(x, y, a.x, a.y);
            const distB = euclideanDistanceSquared(x, y, b.x, b.y);
            return distA - distB;
        });

        return entries.slice(0, count).map(entry => entry.element);
    }

    /**
     * Starting from a given position, iterates cells in levels, like an onion.
     *
     *        +---+
     *    +-+ |   |
     * +  | | |   |
     *    +-+ |   |
     *        +---+
     *
     * @param x
     * @param y
     * @param level
     * @return {Generator<GridSpatialIndexCell>}
     */
    *iterateCellsAtPosition(x, y, level) {
        const centerX = x >>> this.cellSizeExponent;
        const centerY = y >>> this.cellSizeExponent;
        const left = Math.max(centerX - (level - 1), 0);
        const right = Math.min(centerX + (level - 1), this.widthInCells - 1);
        const top = Math.max(centerY - (level - 1), 0);
        const bottom = Math.min(centerY + (level - 1), this.heightInCells - 1);

        if (right - left === 0) {
            const cellIndex = centerY * this.widthInCells + centerX;
            if (cellIndex < this.cells.length) {
                yield this.cells[cellIndex];
            }
        } else {
            // first row
            for (let col = left; col <= right; col++) {
                const cellIndex = top * this.widthInCells + col;
                yield this.cells[cellIndex];
            }
            // intermediate rows
            for (let row = top + 1; row < bottom - 1; row++) {
                const leftCellIndex = row * this.widthInCells + left;
                yield this.cells[leftCellIndex];
                const rightCellIndex = row * this.widthInCells + right;
                yield this.cells[rightCellIndex];
            }
            // last row
            for (let col = left; col <= right; col++) {
                const cellIndex = bottom * this.widthInCells + col;
                yield this.cells[cellIndex];
            }
        }
    }

    /**
     * @private
     * @param rowStart
     * @param rowEnd
     * @param colStart
     * @param colEnd
     */
    debugQueryCells(rowStart, rowEnd, colStart, colEnd) {
        const snappedTop = rowStart << this.cellSizeExponent;
        const snappedBottom = (rowEnd + 1) << this.cellSizeExponent;
        const snappedLeft = colStart << this.cellSizeExponent;
        const snappedRight = (colEnd + 1) << this.cellSizeExponent;

        this.queryDebugInfo = [
            [snappedLeft, snappedTop],
            [snappedRight, snappedTop],
            [snappedRight, snappedBottom],
            [snappedLeft, snappedBottom],
            [snappedLeft, snappedTop]
        ];
    }

    getQueryDebugInfo() {
        return this.queryDebugInfo;
    }

    /**
     * @private
     * @param {Number} mode
     * @param {Number} radius
     * @param {Number} x
     * @param {Number} y
     * @return {Function}
     */
    obtainDistanceFunction(mode, radius, x, y) {
        switch (mode) {
            case GridSpatialIndex.QUERY_MODE_RAW: return this.isAlwaysWithinRadiusFunction;
            case GridSpatialIndex.QUERY_MODE_CIRCLE: return this.isWithinRadius.bind(this, radius, x, y);
            case GridSpatialIndex.QUERY_MODE_SQUARE: return this.isWithinSquare.bind(this, radius, x, y);
            default: throw new Error(`Unknown mode ${mode}`);
        }
    }

    /**
     * @private
     * @param {Number} radius
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     * @return {Boolean}
     */
    isWithinRadius(radius, x0, y0, x1, y1) {
        return Math.hypot(Math.abs(x1 - x0), Math.abs(y1 - y0)) <= radius;
    }

    /**
     * @private
     * @return {boolean}
     */
    isAlwaysWithinRadius() {
        return true;
    }

    /**
     * @private
     * @param {Number} side
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     * @return {Boolean}
     */
    isWithinSquare(side, x0, y0, x1, y1) {
        return Math.abs(x1 - x0) <= side && Math.abs(y1 - y0) <= side;
    }
}
