// derived from https://stackoverflow.com/a/901144
function param(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function findKeyMeaning(code) {
    for (let index = 0; index < inputs.length; index++) {
        if (inputs[index].includes(code)) {
            return {
                meaning: index,
                owner: inputs[index].indexOf(code),
            };
        }
    }
}

function generateRandomTile(rand) {
    switch (Math.round(Math.random() * rand)) {
        case 5:
            return new LockedWall(j, i, Math.round(Math.random() * 2) + 1, Math.round(Math.random()));
        case 1:
        case 2:
            return new Wall(j, i);
        case 4:
            return new ItemBox(j, i);
        case 3:
            return new DirectionalWall(Math.round(Math.random() * 4), j, i);
        case 6:
            return new Turf(j, i);
        default:
            return new Space(j, i);
    };
};

function getMatchingTiles(callback) {
    const matches = [];
    for (let item of arenaMap) {
        for (let item2 of item) {
            if (callback(item2)) {
                matches.push(item2)
            }
        }
    }
    return matches;
}

function getTile(x, y) {
    return arenaMap[y][x];
}

function getMatchingTiles(callback) {
    const matching = [];

    for (let item of arenaMap) {
        for (let item2 of item) {
            if (callback(item2)) {
                matching.push(item2)
            }
        }
    }

    return matching;
}

function getSpawnables(pid) {
    const directlySpawnable = getMatchingTiles(function (tile) {
        return tile.constructor.name === "SpawnableSpace" && (tile.restriction === pid || tile.restriction === null);
    });

    if (directlySpawnable.length > 0) {
        return directlySpawnable;
    } else {
        // If no spawnable tiles to be found, just spawn on a space.
        return getMatchingTiles(function (tile) {
            return tile.constructor.name === "Space";
        });
    }
}

function randItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function generateBase(player) {
    getTile(player.x, player.y).changeTo(new HomeSpace(player));
    getTile(player.x, player.y).changeTo(new Occupied(player));
}

function getMousePos(evt) {
    var rect = canvas.getBoundingClientRect(), // abs. size of element
        scaleX = canvas.width / rect.width, // relationship bitmap vs. element for X
        scaleY = canvas.height / rect.height; // relationship bitmap vs. element for Y

    return {
        x: Math.floor((evt.clientX - rect.left) * scaleX / pixelsPerTile), // scale mouse coordinates after they have
        y: Math.floor((evt.clientY - rect.top) * scaleY / pixelsPerTile) // been adjusted to be relative to element
    }
}

function makeArray(w, h) {
    var arr = [];
    for (i = 0; i < h; i++) {
        arr[i] = [];
        for (j = 0; j < w; j++) {
            arr[i][j] = generateRandomTile(20);
        }
    }
    return arr;
}

function tryActionOn(tile, direction, player) {
    if (tile.doFacingAction && typeof tile.doFacingAction === "function") {
        tile.doFacingAction(direction, player);
    }
}

(async function () {
    const canvas = document.getElementById("c");
    const ctx = canvas.getContext("2d");

    ctx.fillText("Hello there! Something might've gone wrong.", canvas.width / 2, canvas.height / 2);

    const hud = document.getElementById("hud");
    const hctx = hud.getContext("2d");

    let mapHoverLocation = {};

    const arenaWidth = Math.ceil(Math.random() * 20);
    const arenaHeight = arenaWidth;

    const pixelsPerTile = 16;
    canvas.width = arenaWidth * pixelsPerTile;
    canvas.height = arenaHeight * pixelsPerTile;

    hud.width = window.innerWidth * 0.80;
    hud.height = window.innerHeight * 0.15;

    canvas.style.width = window.innerWidth * 0.80 + "px";
    canvas.style.height = window.innerHeight * 0.80 + "px";

    let currentTurn = 0;
    const playerCount = param("players") || 2;
    const sandbox = param("sandbox") != true;
    const cooperative = param("coop") != true;

    let inputs = [
        ["KeyW", "KeyI", "ArrowUp"],
        ["KeyA", "KeyJ", "ArrowLeft"],
        ["KeyS", "KeyK", "ArrowDown"],
        ["KeyD", "KeyL", "ArrowRight"],
        ["Spacebar"],
    ];

    class Player {
        constructor(id, x, y) {
            this.id = id;

            this.x = x;
            this.y = y;
            this.direction = 0;

            this.color = `hsl(${this.id / playerCount * 360}, 50%, 50%)`;

            this.keys = 0;
        }
    }

    class Space {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.color = "white";

            this.oldTile = null;
            this.occupying = null;
        }

        getColor() {
            return this.color;
        }

        changeTo(newSpace) {
            newSpace.x = this.x;
            newSpace.y = this.y;
            newSpace.oldTile = this;
            newSpace.occupying = this.constructor.name;
            arenaMap[this.y][this.x] = newSpace;
        }

        collides() {
            return false; // Spaces don't collide!! 
        }

        changeBack() {
            if (this.oldTile) {
                this.changeTo(this.oldTile);
                return true;
            } else {
                return false; // Can't change back if there wasn't a tile to revert to.
            }
        }

        toString() {
            return this.constructor.name;
        }
    }

    class SpawnableSpace extends Space {
        constructor(restrictedTo, x, y) {
            super(x, y);
            this.restriction = restrictedTo ? restrictedTo : null;
        }

        toString() {
            return `Spawn space`;
        }
    }

    class Wall extends Space {
        constructor(x, y) {
            super(x, y);
            this.color = "black";
        }

        collides() {
            return true; // Walls are walls...
        }
    }

    class Occupied extends Wall {
        constructor(player, x, y) {
            super(x, y);
            this.occupiedBy = player;
        }

        getColor() {
            return this.occupiedBy.color;
        }

        toString() {
            return `Player ${this.occupiedBy.id + 1}'s tile`;
        }
    }

    class Turf extends Space {
        constructor(x, y) {
            super(x, y);
            this.capturedBy = null;
        }
        getColor() {
            return this.capturedBy ? this.capturedBy.color : "#FFFFFF";
        }
        collides(d, p) {
            this.capturedBy = p;
            return false;
        }
    }

    class HomeSpace extends Wall {
        constructor(owner, x, y) {
            super(x, y);
            this.owner = owner;
            this.color = this.owner.color;
        }

        collides(direction, player) {
            return player.id !== this.owner.id;
        }

        getColor() {
            return this.color = this.owner.color;
        }

        toString() {
            return `Player ${this.owner.id + 1}'s home tile`;
        }
    }

    class LockedWall extends Wall {
        constructor(x, y, keysNeeded = 1, takeAwayKeys = false) {
            super(x, y);
            this.color = "slategray";

            this.keysNeeded = keysNeeded;
            this.takeAwayKeys = takeAwayKeys;
        }

        collides(direction, player) {
            if (player.keys < this.keysNeeded) {
                return true;
            } else {
                if (this.takeAwayKeys) {
                    players[player.id].keys -= this.keysNeeded;
                }
                return false;
            }
        }

        toString() {
            return `${this.takeAwayKeys ? "Unstable l" : "L"}ocked wall requiring ${this.keysNeeded} key${this.keysNeeded === 1 ? "" : "s"}`;
        }
    }

    const directions = [
        "north",
        "east",
        "south",
        "west",
    ];

    class DirectionalWall extends Wall {
        // this type of wall only collides in one direction
        constructor(direction, x, y) {
            super(x, y);

            this.color = "#FFEE00";
            this.direction = direction > -1 && direction < 4 ? direction : 0;
        }

        collides(direction = 2) {
            return direction === this.direction;
        }

        toString() {
            return `One-way gate facing ${directions[this.direction]}`;
        }
    }

    class ToggleableWall extends Wall {
        // this type of wall can be toggled for collision, but starts out closed
        constructor(x, y) {
            super(x, y);

            this.color = "pink";
            this.closed = true;
        }

        collides() {
            return this.closed;
        }

        doFacingAction(direction, player) {
            this.closed = !this.closed;
        }

        toString() {
            return `${this.closed ? "Closed t" : "T"}oggleable wall`;
        }
    }

    class ItemBox extends Space {
        constructor(x, y) {
            super(x, y);

            this.color = "#dd66ff";
            this.active = true;
        }

        collides(direction, player) {
            if (this.active) {
                players[player.id].keys += 1;
                this.active = false;
            }
            return false;
        }

        toString() {
            return this.active ? "Item box" : "Empty item box";
        }
    }

    class CooperativeSwitch extends Space {
        constructor(x, y) {
            super(x, y);

            this.color = "#7777FF";
        }
    }

    class CooperativePuzzleWall extends Wall {
        constructor(strengthNeeded, x, y) {
            super(x, y);

            this.color = "#9999FF";
            this.strengthNeeded = strengthNeeded;
        }

        collides() {
            return getMatchingTiles((item) => {
                if (item.constructor.name !== "Occupied") return false;
                return item.oldTile.constructor.name === "CooperativeSwitch";
            }).length < this.strengthNeeded;
        }

        toString() {
            return `Cooperative wall`;
        }
    }

    getTile(0, 0).changeTo(new SpawnableSpace(null));
    getTile(0, arenaHeight).changeTo(new SpawnableSpace(null));
    getTile(arenaWidth, 0).changeTo(new SpawnableSpace(null));
    getTile(arenaWidth, arenaHeight).changeTo(new SpawnableSpace(null));


    const players = [];
    for (let p = 0; p < playerCount; p++) {
        const randSpace = randItem(getSpawnables(p));
        const playerX = randSpace.x;
        const playerY = randSpace.y;

        players.push(new Player(p, playerX, playerY));
        generateBase(players[p]);
    }

    const arenaMap = makeArray(arenaWidth, arenaHeight);

    canvas.addEventListener("mousemove", (event) => {
        const pos = getMousePos(event);
        mapHoverLocation = {
            coordinates: pos,
            tile: getTile(pos.x, pos.y),
        };
    });

    const totalKeys = null; // fix this once I am able to get access to the get tiles that match callback

    window.addEventListener("keydown", (event) => {
        const keybind = findKeyMeaning(event.code);
        const curPl = cooperative ? players[keybind.owner] : players[currentTurn];
        const plId = curPl.id;

        let curTile = getTile(curPl.x, curPl.y);

        let finishedTurn = true; // Only set to false if none of the keys with a case below were pressed or failed move.

        switch (keybind.meaning) {
            case 0:
                const tileUp = getTile(curPl.x, curPl.y - 1);

                players[plId].direction = 0;
                if (!tileUp.collides(2, curPl) || (sandbox && event.shiftKey)) {
                    curTile.changeBack();
                    tileUp.changeTo(curTile);
                    players[plId].y--;
                } else {
                    finishedTurn = false;
                }
                break;
            case 1:
                const tileLeft = getTile(curPl.x - 1, curPl.y);
                players[plId].direction = 1;
                if (!tileLeft.collides(3, curPl) || (sandbox && event.shiftKey)) {
                    curTile.changeBack();
                    tileLeft.changeTo(curTile);
                    players[plId].x--;
                } else {
                    finishedTurn = false;
                }
                break;
            case 2:
                const tileDown = getTile(curPl.x, curPl.y + 1);
                players[plId].direction = 2;
                if (!tileDown.collides(0, curPl) || (sandbox && event.shiftKey)) {
                    curTile.changeBack();
                    tileDown.changeTo(curTile);
                    players[plId].y++;
                } else {
                    finishedTurn = false;
                }
                break;
            case 3:
                const tileRight = getTile(curPl.x + 1, curPl.y);
                players[plId].direction = 3;
                if (!tileRight.collides(1, curPl) || (sandbox && event.shiftKey)) {
                    curTile.changeBack();
                    tileRight.changeTo(curTile);
                    players[plId].x++;
                } else {
                    finishedTurn = false;
                }
                break;
            case 4:
                switch (curPl.direction) {
                    case 1:
                        tryActionOn(getTile(curPl.x - 1, curPl.y), 1, curPl);
                        break;
                    case 2:
                        tryActionOn(getTile(curPl.x, curPl.y + 1), 2, curPl);
                        break;
                    case 3:
                        tryActionOn(getTile(curPl.x + 1, curPl.y), 3, curPl);
                        break;
                    default:
                        tryActionOn(getTile(curPl.x, curPl.y - 1), 0, curPl);
                        break;
                }
                break;
            default:
                finishedTurn = false;
        }
        if (finishedTurn && !(sandbox && event.altKey)) {
            currentTurn++;
            if (currentTurn === players.length) {
                currentTurn = 0;
            }
        }
    });

    function tile(x = 0, y = 0, fillStyle = "white") {
        const oldStyle = ctx.fillStyle;
        ctx.fillStyle = fillStyle;

        ctx.fillRect(x * pixelsPerTile, y * pixelsPerTile, pixelsPerTile, pixelsPerTile);

        ctx.fillStyle = oldStyle;
        return;
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < arenaHeight; y++) {
            for (let x = 0; x < arenaWidth; x++) {
                const curTile = getTile(x, y);
                const underTile = curTile.oldTile;
                if (underTile) {
                    tile(underTile.x, underTile.y, underTile.getColor());
                }
                tile(curTile.x, curTile.y, curTile.getColor());
            }
        }

        // Clear the HUD.
        hctx.fillStyle = "#222222";
        hctx.fillRect(0, 0, hud.width, hud.height);

        // Get some HUD backgrounds.
        hctx.fillStyle = cooperative ? "#77ffff" : players[currentTurn].color;
        hctx.fillRect(0, 0, hud.width / 4, hud.height);

        // Cool font and color.
        hctx.font = `${hud.width / 20}px Ubuntu`;
        hctx.fillStyle = "white";

        // Center text.
        hctx.textAlign = "center";
        hctx.textBaseline = "middle";

        // Render some HUD stats.
        const playerText = cooperative ? "CO-OP" : `PLAYER ${currentTurn + 1}`;
        hctx.fillText(playerText, hud.width / 8, hud.height / 2);

        hctx.font = "12px Ubuntu";
        hctx.textBaseline = "top";

        if (sandbox) {
            hctx.textAlign = "right";
            hctx.fillText("*", hud.width / 4 - 1, 0);
        }

        hctx.textAlign = "left";
        const text = [
            "Use WASD, arrows, and/or IJKL to navigate.",
            cooperative ? "Work together to do things." : "Each player takes turns moving.",
            "You can only move to tiles that are white (empty spaces).",
            "There is no objective yet.",
            "Have fun!"
        ];

        text.forEach((value, index) => {
            hctx.fillText(value, hud.width / 8 * 2 + 12, index * 12);
        });

        if (mapHoverLocation.coordinates) {
            const crds = mapHoverLocation.coordinates;

            hctx.textAlign = "right";
            hctx.textBaseline = "middle";

            if (mapHoverLocation.tile.toString()) {
                hctx.fillText(mapHoverLocation.tile.toString(), hud.width - 12, hud.height - 12);
                hctx.fillText(`(${crds.x}, ${crds.y})`, hud.width - 12, hud.height - 24);
            } else {
                hctx.fillText(`(${crds.x}, ${crds.y})`, hud.width - 12, hud.height - 12);
            }
        }

        const keys = players[currentTurn].keys;
        hctx.textAlign = "left";
        hctx.textBaseline = "middle";
        hctx.fillText(`Has ${keys} key${keys === 1 ? "" : "s"}, facing ${directions[players[currentTurn].direction]}`, hud.width / 8 * 2 + 12, hud.height - 12);

        // AGAIN!
        window.requestAnimationFrame(render);
    }

    window.requestAnimationFrame(render);
})();